import type * as TS from 'typescript'
import * as vscode from 'vscode-languageserver-types'
import {VS2TSTranslator} from './vs-ts-translator'
import {LuposService} from '../lupos-service'
import {Logger, ProjectContext} from '../core'
import {TemplateLanguageService} from './types'
import {Template} from './template'
import {TemplateEmbeddedRegion} from './embedded-region'
import {SharedCSSService, SharedHTMLService} from '../shared-services'
import {DiagnosticModifier, TemplatePartType} from '../lupos-ts-module'


/**
 * It helps to route to different templates like html`...` css`...` parts of a ts document,
 * treat them as dependent document, and provides language service for them.
 */
export class TemplateServiceRouter implements TemplateLanguageService {

	readonly context: ProjectContext
	readonly tsService: TS.LanguageService

	private luposService: LuposService

	constructor(context: ProjectContext) {
		this.context = context
		this.tsService = context.service
		this.luposService = new LuposService(context)

		Logger.log('Lupos Plugin Started')
	}

	getCompletionsAtPosition(template: Template, temOffset: number, gloOffset: number): TS.CompletionInfo | undefined {
		let region = template.embedded.getRegionAt(temOffset)
		let tsCompletions: TS.CompletionInfo = VS2TSTranslator.makeEmptyTSCompletion()

		if (region.languageId === 'html') {
			let luposCompletions = this.luposService.getCompletionInfo(template, temOffset, gloOffset)
			if (luposCompletions) {
				tsCompletions.entries.push(...luposCompletions.entries)
			}
		}

		let regOffset = region.templateOffsetToLocal(temOffset)
		let regPosition = region.localOffsetToPosition(regOffset)
		let vsRegionCompletions = this.getVSCodeCompletionItems(region, regPosition)
		if (vsRegionCompletions) {
			let completions = VS2TSTranslator.translateVSCompletionToTS(vsRegionCompletions, region)
			if (completions) {
				tsCompletions.entries.push(...completions.entries)
			}
		}

		return tsCompletions
	}

	getCompletionEntryDetails(template: Template, temOffset: number, gloOffset: number, name: string): TS.CompletionEntryDetails | undefined {
		let region = template.embedded.getRegionAt(temOffset)

		if (region.languageId === 'html') {
			let luposCompletionDetails = this.luposService.getCompletionEntryDetails(template, temOffset, gloOffset, name)
			if (luposCompletionDetails) {
				return luposCompletionDetails
			}
		}

		let regOffset = region.templateOffsetToLocal(temOffset)
		let regPosition = region.localOffsetToPosition(regOffset)
		let vsCompletions = this.getVSCodeCompletionItems(region, regPosition)

		let item = vsCompletions?.items.find(x => x.label === name)
		if (item) {
			return VS2TSTranslator.translateVSCompletionToEntryDetailsToTS(item)
		}

		return undefined
	}

	private getVSCodeCompletionItems(region: TemplateEmbeddedRegion, position: TS.LineAndCharacter) {
		let completions: vscode.CompletionList | undefined

		if (region.languageId === 'html') {
			let htmlDocument = region.htmlDocument!
			completions = SharedHTMLService.doComplete(region.document, position, htmlDocument)
		}
		else if (region.languageId === 'css') {
			let stylesheet = region.stylesheet!
			completions = SharedCSSService.doComplete(region.document, position, stylesheet)
		}

		return completions
	}

	getQuickInfoAtPosition(template: Template, temOffset: number, gloOffset: number): TS.QuickInfo | undefined {
		let region = template.embedded.getRegionAt(temOffset)
		let hover: vscode.Hover | null = null
		let regOffset = region.templateOffsetToLocal(temOffset)
		let regPosition = region.localOffsetToPosition(regOffset)

		if (region.languageId === 'html') {
			let tsHover = this.luposService.getQuickInfo(template, temOffset, gloOffset)
			if (tsHover) {
				return tsHover
			}

			let htmlDocument = region.htmlDocument!
			hover = SharedHTMLService.doHover(region.document, regPosition, htmlDocument)
		}
		else if (region.languageId === 'css') {
			let stylesheet = region.stylesheet!
			hover = SharedCSSService.doHover(region.document, regPosition, stylesheet)
		}

		if (hover) {
			return VS2TSTranslator.translateVSHoverToTS(hover, regPosition, region)
		}

		return undefined
	}

	getDefinitionAndBoundSpan(template: Template, temOffset: number, gloOffset: number): TS.DefinitionInfoAndBoundSpan | undefined {
		let region = template.embedded.getRegionAt(temOffset)
		let regOffset = region.templateOffsetToLocal(temOffset)

		if (region.languageId === 'html') {
			let luposDefinitions = this.luposService.getDefinition(template, regOffset, gloOffset)
			if (luposDefinitions) {
				return luposDefinitions
			}
		}

		return undefined
	}

	getOutliningSpans(template: Template): TS.OutliningSpan[] {
		let region = template.embedded.getWholeTemplateRegion()
		let ranges: vscode.FoldingRange[] = []

		if (region.languageId === 'html') {
			ranges = SharedHTMLService.getFoldingRanges(region.document)
		}
		else if (region.languageId === 'css') {
			ranges = SharedCSSService.getFoldingRanges(region.document)
		}

		return ranges.map(range => VS2TSTranslator.translateOutliningSpanToTS(range, region))
	}

	/** Note diagnostics are located in global origin. */
	modifySemanticDiagnostics(template: Template, modifier: DiagnosticModifier) {
		let wholeRegion = template.embedded.getWholeTemplateRegion()
		let regions = template.embedded.getAllRegions()

		for (let region of regions) {
			if (region.languageId === 'html') {
				this.luposService.modifyDiagnostics(template, modifier)
			}
			else if (region.languageId === 'css') {
				let stylesheet = region.stylesheet!
				let vsDiags = SharedCSSService.doValidation(region.document, stylesheet)
				let tsDiags = VS2TSTranslator.translateVSDiagnosticsToTS(vsDiags, template.sourceFile, region.document, region, template)

				// Means not filter inline style.
				if (region === wholeRegion) {
					tsDiags = this.filterCSSDiagnostics(tsDiags, vsDiags, template)
				}

				for (let diag of tsDiags) {
					modifier.addDiagnostic(diag)
				}
			}
		}
	}

	private filterCSSDiagnostics(tsDiags: TS.Diagnostic[], vsDiags: vscode.Diagnostic[], template: Template) {
		return tsDiags.filter((tsDiag: TS.Diagnostic, index: number) => {
			let vsDiag = vsDiags[index]

			// An independent part: `.a{} ${...}` -> `.a{} _LUPOS_SLOT_INDEX_0_`,
			// Get diagnostic `{` required.
			if (vsDiag.code !== 'css-lcurlyexpected') {
				return true
			}

			let startGlo = tsDiag.start!
			let startTem = template.globalOffsetToLocal(startGlo)
			let content = template.content

			let part = template.parts.findLast(part => {
				return part.type === TemplatePartType.SlottedText
					&& part.start <= startTem
					&& part.end >= startTem
			})

			if (!part) {
				return true
			}

			let valueIndex = part.valueIndices?.findLast(index => index.end <= startTem)
			if (!valueIndex) {
				return true
			}

			// Diagnostic position located after a `$LUPOS_SLOT_INDEX_\d+$`, may place some whitespaces.
			if (/^\s*$/.test(content.slice(valueIndex.end, startTem))) {
				return false
			}

			return true
		})
	}

	/** Note code fixes are located in global origin. */
	getCodeFixesAtPosition(template: Template, gloStart: number, gloEnd: number, errorCodes: ReadonlyArray<number>): TS.CodeFixAction[] {
		let region = template.embedded.getWholeTemplateRegion()
		let regStart = region.templateOffsetToLocal(gloStart)
		let regEnd = region.templateOffsetToLocal(gloEnd)
		let regRange = VS2TSTranslator.makeVSRange(regStart, regEnd, region)

		if (region.languageId === 'html') {
			let luposCodeFixes = this.luposService.getCodeFixesAtPosition(template, regStart, errorCodes)
			return luposCodeFixes || []
		}
		else if (region.languageId === 'css') {
			let stylesheet = region.stylesheet!

			let intersectedVSDiagnostics = SharedCSSService.doValidation(region.document, stylesheet)
				.filter(diagnostic => {
					let regDiagStart = region.localPositionToOffset(diagnostic.range.start)
					let regDiagEnd = region.localPositionToOffset(diagnostic.range.end)

					// Whether intersected.
					return Math.max(regDiagStart, regStart) < Math.min(regDiagEnd, regEnd)
				})

			let codeActions = SharedCSSService.doCodeActions(region.document, regRange, {diagnostics: intersectedVSDiagnostics}, stylesheet)

			return VS2TSTranslator.translateVSCodeFixActionsToTS(
				codeActions,
				template.fileName,
				region,
				template
			)
		}

		return []
	}

	getReferencesAtPosition(template: Template, temOffset: number, _gloOffset: number): TS.ReferencedSymbol[] | undefined {
		let region = template.embedded.getRegionAt(temOffset)
		let regPosition = region.localOffsetToPosition(region.templateOffsetToLocal(temOffset))
		let highlights: vscode.DocumentHighlight[] | undefined

		if (region.languageId === 'html') {
			let htmlDocument = region.htmlDocument!
			highlights = SharedHTMLService.findDocumentHighlights(region.document, regPosition, htmlDocument)
		}
		else if (region.languageId === 'css') {
			let stylesheet = region.stylesheet!
			highlights = SharedCSSService.findDocumentHighlights(region.document, regPosition, stylesheet)
		}

		if (highlights) {
			return VS2TSTranslator.translateVSHighlightsToReferenceSymbol(highlights, template.fileName, regPosition, region)
		}

		return undefined
	}

	getJsxClosingTagAtPosition(template: Template, gloOffset: number): TS.JsxClosingTagInfo | undefined {
		let temOffset = template.globalOffsetToLocal(gloOffset)
		let region = template.embedded.getRegionAt(temOffset)
		let regPosition = region.localOffsetToPosition(region.templateOffsetToLocal(temOffset))

		if (region.languageId === 'html') {
			let htmlDocument = region.htmlDocument!
			let tagComplete = SharedHTMLService.doTagComplete(region.document, regPosition, htmlDocument)

			if (!tagComplete) {
				return undefined
			}

			// HTML returned completions having `$0` like snippet placeholders.
			return {
				newText: VS2TSTranslator.removeSnippetPlaceholders(tagComplete),
			}
		}

		return undefined
	}
}
