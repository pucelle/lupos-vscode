import type * as TS from 'typescript'
import {FoldingRange} from 'vscode-html-languageservice'
import * as vscode from 'vscode-languageserver-types'
import {PluginConfig, ts} from '../core'
import {OriginTranslator} from './types'
import {TextDocument} from 'vscode-languageserver-textdocument'


/** 
 * Reference to https://github.com/microsoft/typescript-styled-plugin/blob/master/src/_language-service.ts
 * It translate vscode service data items to typescript service data items.
 */
export namespace VS2TSTranslator {

	export function translateVSHoverToTS(hover: vscode.Hover, position: TS.LineAndCharacter, origin: OriginTranslator): TS.QuickInfo {
		let header: TS.SymbolDisplayPart[] = []
		let documentation: TS.SymbolDisplayPart[] = []

		let convertPart = (hoverContents: typeof hover.contents) => {
			if (typeof hoverContents === 'string') {
				documentation.push({kind: 'unknown', text: hoverContents})
			}
			else if (Array.isArray(hoverContents)) {
				hoverContents.forEach(convertPart)
			}
			else {
				header.push({kind: 'unknown', text: hoverContents.value})
			}
		}

		convertPart(hover.contents)

		let start = origin.localOffsetToTemplate(origin.localPositionToOffset(hover.range ? hover.range.start : position))
		let end = hover.range ? origin.localOffsetToTemplate(origin.localPositionToOffset(hover.range.end)) : start + 1
		let length = end - start

		return {
			kind: ts.ScriptElementKind.string,
			kindModifiers: '',
			textSpan: {
				start,
				length,
			},
			displayParts: header,
			documentation,
			tags: [],
		}
	}

	export function translateVSCodeFixActionsToTS(codeActions: vscode.Command[], fileName: string, origin: OriginTranslator): TS.CodeFixAction[] {
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
					changes: edits.map(edit => translateVSTextEditToTS(edit, fileName, origin)),
				})
			}
		}

		return actions
	}

	function translateVSTextEditToTS(textEdit: vscode.TextEdit, fileName: string, origin: OriginTranslator): TS.FileTextChanges {
		let start = origin.localOffsetToTemplate(origin.localPositionToOffset(textEdit.range.start))
		let end = origin.localOffsetToTemplate(origin.localPositionToOffset(textEdit.range.end))

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


	/** vscode snippet syntax `$1` not been supported in typescript. */
	export function removeSnippetPlaceholders(label: string) {
		return label.replace(/\$\d/g, '')
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

	function translateVSCompletionItemKindToTS(kind: vscode.CompletionItemKind): TS.ScriptElementKind {
		switch (kind) {
			case vscode.CompletionItemKind.Method:
				return ts.ScriptElementKind.memberFunctionElement

			case vscode.CompletionItemKind.Function:
				return ts.ScriptElementKind.functionElement

			case vscode.CompletionItemKind.Constructor:
				return ts.ScriptElementKind.constructorImplementationElement

			case vscode.CompletionItemKind.Field:
			case vscode.CompletionItemKind.Variable:
				return ts.ScriptElementKind.variableElement

			case vscode.CompletionItemKind.Class:
				return ts.ScriptElementKind.classElement

			case vscode.CompletionItemKind.Interface:
				return ts.ScriptElementKind.interfaceElement

			case vscode.CompletionItemKind.Module:
				return ts.ScriptElementKind.moduleElement

			case vscode.CompletionItemKind.Property:
				return ts.ScriptElementKind.memberVariableElement

			case vscode.CompletionItemKind.Unit:
			case vscode.CompletionItemKind.Value:
				return ts.ScriptElementKind.constElement

			case vscode.CompletionItemKind.Enum:
				return ts.ScriptElementKind.enumElement

			case vscode.CompletionItemKind.Keyword:
				return ts.ScriptElementKind.keyword

			case vscode.CompletionItemKind.Color:
				return ts.ScriptElementKind.constElement

			case vscode.CompletionItemKind.Reference:
				return ts.ScriptElementKind.alias

			case vscode.CompletionItemKind.File:
				return ts.ScriptElementKind.moduleElement

			case vscode.CompletionItemKind.Snippet:
			case vscode.CompletionItemKind.Text:
			default:
				return ts.ScriptElementKind.unknown
		}
	}


	export function translateVSDiagnosticsToTS(
		diagnostics: vscode.Diagnostic[],
		sourceFile: TS.SourceFile,
		document: TextDocument,
		origin: OriginTranslator
	): TS.Diagnostic[] {
		return diagnostics.map(diag => translateVSDiagnosticToTS(diag, sourceFile, document, origin)).filter(v => v) as TS.Diagnostic[]
	}

	function translateVSDiagnosticToTS(
		diagnostic: vscode.Diagnostic,
		file: TS.SourceFile,
		document: TextDocument,
		origin: OriginTranslator
	): TS.Diagnostic | undefined {
		
		// Make sure returned error is within the real document.
		if (diagnostic.range.start.line === 0
			|| diagnostic.range.start.line > document.lineCount
			|| diagnostic.range.start.character >= document.getText().length
		) {
			return undefined
		}

		let start = origin.localOffsetToTemplate(origin.localPositionToOffset(diagnostic.range.start))
		let end = origin.localOffsetToTemplate(origin.localPositionToOffset(diagnostic.range.end))
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