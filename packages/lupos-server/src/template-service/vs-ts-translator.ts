import type * as TS from 'typescript'
import {FoldingRange} from 'vscode-html-languageservice'
import * as vscode from 'vscode-languageserver-types'
import {PluginConfig, ts} from '../core'
import {OriginTranslator} from './types'
import {TextDocument} from 'vscode-languageserver-textdocument'
import {Template} from './template'


/** 
 * Reference to https://github.com/styled-components/typescript-styled-plugin/blob/master/src/_language-service.ts
 * It translate vscode service data items to typescript service data items.
 */
export namespace VS2TSTranslator {

	export function translateVSHoverToTS(hover: vscode.Hover, position: TS.LineAndCharacter, origin: OriginTranslator): TS.QuickInfo {
		let contents: TS.SymbolDisplayPart[] = []

		let convertPart = (hoverContents: typeof hover.contents) => {
			if (typeof hoverContents === 'string') {
				contents.push({kind: 'text', text: hoverContents})
			}
			else if (Array.isArray(hoverContents)) {
				hoverContents.forEach(convertPart)
			}
			else {
				contents.push({kind: 'text', text: hoverContents.value})
			}
		}

		convertPart(hover.contents)

		let start = origin.localOffsetToTemplate(origin.localPositionToOffset(hover.range ? hover.range.start : position))
		let end = hover.range ? origin.localOffsetToTemplate(origin.localPositionToOffset(hover.range.end)) : start + 1
		let length = end - start

		return {
			kind: ts.ScriptElementKind.unknown,
			kindModifiers: '',
			textSpan: {
				start,
				length,
			},
			displayParts: [],
			documentation: contents,
			tags: [],
		}
	}


	/** Will be translated to global. */
	export function translateVSCodeFixActionsToTS(codeActions: vscode.Command[], fileName: string, origin: OriginTranslator, template: Template): TS.CodeFixAction[] {
		let actions: TS.CodeFixAction[] = []

		for (let vsAction of codeActions) {
			if (vsAction.command !== '_css.applyCodeAction') {
				continue
			}

			let edits = vsAction.arguments && vsAction.arguments[2] as vscode.TextEdit[]
			if (edits) {
				actions.push({
					fixName: '',
					description: vsAction.title,
					changes: edits.map(edit => translateVSTextEditToTS(edit, fileName, origin, template)),
				})
			}
		}

		return actions
	}

	function translateVSTextEditToTS(textEdit: vscode.TextEdit, fileName: string, origin: OriginTranslator, template: Template): TS.FileTextChanges {
		let start = template.localOffsetToGlobal(origin.localPositionToOffset(textEdit.range.start))
		let end = template.localOffsetToGlobal(origin.localPositionToOffset(textEdit.range.end))

		return {
			fileName: fileName,
			textChanges: [{
				newText: textEdit.newText,
				span: {
					start,
					length: end - start,
				},
			}],
		}
	}


	export function translateOutliningSpanToTS(range: FoldingRange, origin: OriginTranslator): TS.OutliningSpan {
		let start = origin.localOffsetToTemplate(origin.localPositionToOffset({line: range.startLine, character: range.startCharacter || 0}))
		let end = origin.localOffsetToTemplate(origin.localPositionToOffset({line: range.endLine, character: range.endCharacter || 0}))
		
		let span = {
			start,
			length: end - start,
		}

		return {
			autoCollapse: false,
			kind: ts.OutliningSpanKind.Code,
			bannerText: '',
			textSpan: span,
			hintSpan: span,
		}
	}
	

	export function translateVSCompletionToTS(items: vscode.CompletionList, origin: OriginTranslator): TS.CompletionInfo {
		return {
			isGlobalCompletion: false,
			isMemberCompletion: false,
			isNewIdentifierLocation: false,
			entries: items.items.map(x => translateVSCompletionEntryToTS(x, origin)),
		}
	}

	function translateVSCompletionEntryToTS(vsItem: vscode.CompletionItem, origin: OriginTranslator): TS.CompletionEntry {
		let kind = vsItem.kind ? translateVSCompletionItemKindToTS(vsItem.kind) : ts.ScriptElementKind.unknown
		let name = removeSnippetPlaceholders(vsItem.label)

		let entry: TS.CompletionEntry = {
			name: removeSnippetPlaceholders(vsItem.label),
			kind,
			sortText: name,
		}

		if (vsItem.textEdit) {
			entry.insertText = removeSnippetPlaceholders(vsItem.textEdit.newText)

			if (vsItem.textEdit.hasOwnProperty('range')) {
				entry.replacementSpan = toTSTextSpan((vsItem.textEdit as vscode.TextEdit).range, origin)
			}
			else {
				entry.replacementSpan = toTSTextSpan((vsItem.textEdit as vscode.InsertReplaceEdit).replace, origin)
			}
		}

		return entry
	}

	function toTSTextSpan(range: vscode.Range, origin: OriginTranslator): TS.TextSpan {
		let start = origin.localOffsetToTemplate(origin.localPositionToOffset(range.start))
		let end = origin.localOffsetToTemplate(origin.localPositionToOffset(range.end))

		return {
			start,
			length: end - start,
		}
	}


	export function makeEmptyTSCompletion(): TS.CompletionInfo {
		return {
			isGlobalCompletion: false,
			isMemberCompletion: false,
			isNewIdentifierLocation: false,
			entries: [],
		}
	}


	/** vscode snippet syntax `$1` or `${1:...} `${1|...}` not been supported in typescript. */
	export function removeSnippetPlaceholders(label: string) {
		return label
			.replace(/\$\{\d+:(\w+).*?\}/g, '$1')
			.replace(/\$\{\d+\|(\w+),.*?\}/g, '$1')
			.replace(/\$\{\d+\|.*?\}/g, '')
			.replace(/\$\d/g, '')
	}


	export function translateVSCompletionToEntryDetailsToTS(item: vscode.CompletionItem): TS.CompletionEntryDetails {
		return {
			name: item.label,
			kindModifiers: 'declare',
			kind: item.kind ? translateVSCompletionItemKindToTS(item.kind) : ts.ScriptElementKind.unknown,
			displayParts: toDisplayParts(item.detail),
			documentation: toDisplayParts(item.documentation),
			tags: [],
		} 
	}

	function toDisplayParts(text: string | vscode.MarkupContent | undefined): TS.SymbolDisplayPart[] {
		if (!text) {
			return []
		}

		return [{
			kind: 'text',
			text: typeof text === 'string' ? text : text.value,
		}]
	}


	/** Completion icon previews at `./images`.	 */
	function translateVSCompletionItemKindToTS(kind: vscode.CompletionItemKind): TS.ScriptElementKind {
		switch (kind) {
			case vscode.CompletionItemKind.Class:
				return ts.ScriptElementKind.classElement

			case vscode.CompletionItemKind.Constructor:
				return ts.ScriptElementKind.constructorImplementationElement

			case vscode.CompletionItemKind.Enum:
				return ts.ScriptElementKind.enumElement

			case vscode.CompletionItemKind.EnumMember:
				return ts.ScriptElementKind.enumMemberElement

			case vscode.CompletionItemKind.Folder:
				return ts.ScriptElementKind.directory
				
			case vscode.CompletionItemKind.Function:
				return ts.ScriptElementKind.functionElement

			case vscode.CompletionItemKind.Interface:
				return ts.ScriptElementKind.interfaceElement
	
			case vscode.CompletionItemKind.Keyword:
				return ts.ScriptElementKind.keyword

			case vscode.CompletionItemKind.Method:
				return ts.ScriptElementKind.functionElement

			case vscode.CompletionItemKind.Module:
				return ts.ScriptElementKind.moduleElement

			case vscode.CompletionItemKind.Variable:
				return ts.ScriptElementKind.variableElement

			
			// Name like, but icons are not similar.
			case vscode.CompletionItemKind.TypeParameter:
				return ts.ScriptElementKind.typeParameterElement


			// Have similar icon.
			
			case vscode.CompletionItemKind.Field:
				return ts.ScriptElementKind.memberVariableElement

			case vscode.CompletionItemKind.File:
				return ts.ScriptElementKind.scriptElement

			case vscode.CompletionItemKind.Property:
				return ts.ScriptElementKind.memberAccessorVariableElement

			case vscode.CompletionItemKind.Value:
				return ts.ScriptElementKind.enumElement

			case vscode.CompletionItemKind.Text:
				return ts.ScriptElementKind.warning


			// Haven't find match:
			case vscode.CompletionItemKind.Color:
			case vscode.CompletionItemKind.Event:
			case vscode.CompletionItemKind.Operator:
			case vscode.CompletionItemKind.Snippet:
			case vscode.CompletionItemKind.Struct:
			case vscode.CompletionItemKind.Unit:
			case vscode.CompletionItemKind.Reference:

			default:
				return ts.ScriptElementKind.unknown
		}
	}


	/** Will be translated to global. */
	export function translateVSDiagnosticsToTS(
		diagnostics: vscode.Diagnostic[],
		sourceFile: TS.SourceFile,
		document: TextDocument,
		origin: OriginTranslator,
		template: Template
	): TS.Diagnostic[] {
		return diagnostics.map(diag => translateVSDiagnosticToTS(diag, sourceFile, document, origin, template)).filter(v => v) as TS.Diagnostic[]
	}

	function translateVSDiagnosticToTS(
		diagnostic: vscode.Diagnostic,
		file: TS.SourceFile,
		document: TextDocument,
		origin: OriginTranslator,
		template: Template
	): TS.Diagnostic | undefined {
		
		// Make sure returned error is within the real document.
		if (diagnostic.range.start.line === 0
			|| diagnostic.range.start.line > document.lineCount
			|| diagnostic.range.start.character >= document.getText().length
		) {
			return undefined
		}

		let start = template.localOffsetToGlobal(origin.localPositionToOffset(diagnostic.range.start))
		let end = template.localOffsetToGlobal(origin.localPositionToOffset(diagnostic.range.end))
		let length = end - start
		let code = typeof diagnostic.code === 'number' ? diagnostic.code : 0
		
		return {
			code,
			messageText: diagnostic.message,
			category: translateSeverity(diagnostic.severity),
			file,
			start,
			length,
			source: PluginConfig.pluginName,
		}
	}

	function translateSeverity(severity: vscode.DiagnosticSeverity | undefined): TS.DiagnosticCategory {
		switch (severity) {
			case vscode.DiagnosticSeverity.Information:
			case vscode.DiagnosticSeverity.Hint:
				return ts.DiagnosticCategory.Message
	
			case vscode.DiagnosticSeverity.Warning:
				return ts.DiagnosticCategory.Warning
	
			case vscode.DiagnosticSeverity.Error:
			default:
				return ts.DiagnosticCategory.Error
		}
	}

	
	export function makeVSRange(start: number, end: number, origin: OriginTranslator): vscode.Range {
		return {
			start: origin.localOffsetToPosition(start),
			end: origin.localOffsetToPosition(end),
		}
	}


	export function translateTSCompletionEntryToEntryDetails(entry: TS.CompletionEntry): TS.CompletionEntryDetails {
		return {
			name: entry.name,
			kindModifiers: entry.kindModifiers || 'declare',
			kind: entry.kind,
			displayParts: [],
			documentation: [],
			tags: [],
		}
	}

	
	export function translateVSHighlightsToReferenceSymbol(
		highlights: vscode.DocumentHighlight[],
		fileName: string, 
		position: vscode.Position,
		origin: OriginTranslator
	): TS.ReferencedSymbol[] {
		let references: TS.ReferenceEntry[] = highlights.map(highlight => {
			let textSpan = toTSTextSpan(highlight.range, origin)
			let start = origin.localOffsetToTemplate(textSpan.start)

			textSpan.start = start

			return {
				isWriteAccess: false,
        		isDefinition: false,
				fileName,
				textSpan,
			}
		})

		let start = origin.localOffsetToTemplate(origin.localPositionToOffset(position))
		
		let definitionSpan: TS.TextSpan = {
			start: start,
			length: 0,
		}

		return [{
			definition: {
				containerKind: ts.ScriptElementKind.string,
				containerName: '',
				displayParts: [],
				fileName: fileName,
				kind: ts.ScriptElementKind.string,
				name: '',
				textSpan: definitionSpan,
			},
			references,
		}]
	}
}