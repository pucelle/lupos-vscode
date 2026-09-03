
// Inspired from https://github.com/microsoft/typescript-template-language-service-decorator


import type TS from 'typescript'
import {Template, TemplateProvider, TemplateLanguageService, TemplateServiceRouter} from '../template-service'
import {ProjectContext, ts} from '../core'
import {DiagnosticModifier} from '../lupos-ts-module'


/** from `(A, B) => C` to `(D: () => C, A, B) => C` */
type LanguageServiceWrapper<K extends keyof TS.LanguageService>
	= TS.LanguageService[K] extends (...args: infer A) => infer R
		? (callOriginal: () => R, ...args: A) => R
		: never


/** 
 * It proxies a language service,
 * and choose to replace or merge original service results by a template service.
 */
export class TSLanguageServiceProxy {
	
	readonly context: ProjectContext
	readonly templateService: TemplateLanguageService

	private templateProvider: TemplateProvider
	private readonly wrappers: {name: keyof TS.LanguageService, wrapper: LanguageServiceWrapper<any>}[] = []

	constructor(context: ProjectContext) {
		this.context = context
		this.templateProvider = new TemplateProvider(context)
		this.templateService = new TemplateServiceRouter(context, this.templateProvider)

		this.wrapGetCompletionsAtPosition()
		this.wrapGetCompletionEntryDetails()
		this.wrapGetQuickInfoAtPosition()
		this.wrapGetDefinitionAtPosition()
		this.wrapGetDefinitionAndBoundSpan()
		this.wrapGetSemanticDiagnostics()
		this.wrapGetSyntacticDiagnostics()
		this.wrapGetFormattingEditsForRange()
		this.wrapGetCodeFixesAtPosition()
		this.wrapGetSupportedCodeFixes()
		this.wrapGetSignatureHelpItemsAtPosition()
		this.wrapGetOutliningSpans()
		this.wrapGetReferencesAtPosition()
		this.wrapGetRenameInfo()
		this.wrapFindRenameLocations()
		this.wrapGetJsxClosingTagAtPosition()
	}

	/** Decorate with low level typescript language service. */
	decorate(): TS.LanguageService {
		let rawLanguageService = this.context.service as any

		// Directly overwrite property, not use Proxy any more.
		// Or will have conflict with other plugins like Vue.
		for (let {name, wrapper} of this.wrappers) {
			let rawServiceFn = rawLanguageService[name]

			rawLanguageService[name] = (...args: any[]) => {
				let callOriginal = () => rawServiceFn(...args)
				return wrapper(callOriginal, ...args)
			}
		}

		return rawLanguageService
	}

	/** Wrap with a interpolated service function. */
	private wrap<K extends keyof TS.LanguageService>(name: K, wrapper: LanguageServiceWrapper<K>) {
		this.wrappers.push({
			name,
			wrapper
		})
	}

	private wrapGetCompletionsAtPosition() {
		if (!this.templateService.getCompletionsAtPosition) {
			return
		}

		this.wrap('getCompletionsAtPosition', (callOriginal, fileName: string, gloOffset: number, options) => {
			let template = this.templateProvider.getTemplateAt(fileName, gloOffset)
			if (!template) {
				return callOriginal()
			}

			// Replace with lupos template completion.
			let temOffset = template.globalOffsetToLocal(gloOffset)
			let withinValueRange = template.isWithinValueRange(temOffset)
			let info = this.templateService.getCompletionsAtPosition!(template, temOffset, gloOffset, options)

			if (info) {
				info.entries.forEach(entry => this.translateTextSpan(entry.replacementSpan, template!))
			}

			if (withinValueRange && (!info || info.entries.length === 0)) {
				return callOriginal()
			}

			return info
		})
	}

	/** From template origin to global origin. */
	private translateTextSpan(textSpan: TS.TextSpan | undefined, template: Template) {
		if (textSpan) {
			textSpan.start = template.localOffsetToGlobal(textSpan.start)
		}
	}

	private wrapGetCompletionEntryDetails() {
		if (!this.templateService.getCompletionEntryDetails) {
			return
		}

		this.wrap('getCompletionEntryDetails', (callOriginal, fileName: string, gloOffset: number, name: string, options) => {
			let template = this.templateProvider.getTemplateAt(fileName, gloOffset)
			if (!template) {
				return callOriginal()
			}

			// Replace with lupos template completion.
			let temOffset = template.globalOffsetToLocal(gloOffset)
			let withinValueRange = template.isWithinValueRange(temOffset)
			let entry = this.templateService.getCompletionEntryDetails!(template, temOffset, gloOffset, name, options)

			if (withinValueRange && !entry) {
				return callOriginal()
			}

			return entry
		})
	}

	private wrapGetQuickInfoAtPosition() {
		if (!this.templateService.getQuickInfoAtPosition) {
			return
		}

		this.wrap('getQuickInfoAtPosition', (callOriginal, fileName: string, gloOffset: number) => {
			let template = this.templateProvider.getTemplateAt(fileName, gloOffset)
			if (!template) {
				return callOriginal()
			}
			
			// Replace with lupos template completion.
			let temOffset = template.globalOffsetToLocal(gloOffset)
			let withinValueRange = template.isWithinValueRange(temOffset)
			let info = this.templateService.getQuickInfoAtPosition!(template, temOffset, gloOffset)

			if (info) {
				this.translateTextSpan(info.textSpan, template)
			}

			if (withinValueRange && !info) {
				return callOriginal()
			}

			return info
		})
	}

	private wrapGetDefinitionAtPosition() {
		if (!this.templateService.getDefinitionAtPosition) {
			return
		}

		this.wrap('getDefinitionAtPosition', (callOriginal, fileName: string, gloOffset: number) => {
			let template = this.templateProvider.getTemplateAt(fileName, gloOffset)
			if (!template) {
				return callOriginal()
			}

			// Replace with template definitions.
			let temOffset = template.globalOffsetToLocal(gloOffset)
			let withinValueRange = template.isWithinValueRange(temOffset)
			let definitions = this.templateService.getDefinitionAtPosition!(template, temOffset, gloOffset)

			if (withinValueRange && definitions.length === 0) {
				return callOriginal()
			}

			return definitions
		})
	}

	private wrapGetDefinitionAndBoundSpan() {
		if (!this.templateService.getDefinitionAndBoundSpan) {
			return
		}
		
		this.wrap('getDefinitionAndBoundSpan', (callOriginal, fileName: string, gloOffset: number) => {
			let template = this.templateProvider.getTemplateAt(fileName, gloOffset)
			if (!template) {
				return callOriginal()
			}

			// Replace with template definitions.
			let temOffset = template.globalOffsetToLocal(gloOffset)
			let withinValueRange = template.isWithinValueRange(temOffset)
			let definitionAndSpan = this.templateService.getDefinitionAndBoundSpan!(template, temOffset, gloOffset)

			if (withinValueRange && (!definitionAndSpan || !definitionAndSpan.definitions || definitionAndSpan.definitions.length === 0)) {
				return callOriginal()
			}

			return definitionAndSpan
		})
	}

	private wrapGetSyntacticDiagnostics() {
		if (!this.templateService.getSyntacticDiagnostics) {
			return
		}

		this.wrap('getSyntacticDiagnostics', (callOriginal, fileName: string) => {
			let diagnostics: TS.Diagnostic[] = []

			for (let template of this.templateProvider.getAllTemplates(fileName)) {
				let subDiagnostics = this.templateService.getSyntacticDiagnostics!(template)

				subDiagnostics.forEach(diagnostic => {
					diagnostic.start = template.localOffsetToGlobal(diagnostic.start!)
				})

				diagnostics.push(...subDiagnostics)
			}

			// Merge original diagnostics with template ones.
			return [...callOriginal(), ...diagnostics] as TS.DiagnosticWithLocation[]
		})
	}

	private wrapGetSemanticDiagnostics() {
		if (!this.templateService.modifySemanticDiagnostics) {
			return
		}

		this.wrap('getSemanticDiagnostics', (callOriginal, fileName: string) => {
			let diagnostics = callOriginal()

			let sourceFile = this.context.program.getSourceFile(fileName)
			if (!sourceFile) {
				return diagnostics
			}

			let modifier = new DiagnosticModifier(this.context.helper)
			modifier.setSourceFile(sourceFile)

			for (let template of this.templateProvider.getAllTemplates(fileName)) {
				this.templateService.modifySemanticDiagnostics!(template, modifier)
			}

			// Diagnostics are already in global origin, no need to translate.
			return modifier.getModified(diagnostics)
		})
	}

	private wrapGetFormattingEditsForRange() {
		if (!this.templateService.getFormattingEditsForRange) {
			return
		}

		this.wrap('getFormattingEditsForRange', (callOriginal, fileName: string, startGlo: number, endGlo: number, options: TS.FormatCodeSettings) => {
			let changes: TS.TextChange[] = []

			for (let template of this.templateProvider.getAllTemplates(fileName)) {
				if (!template.intersectWith(startGlo, endGlo)) {
					continue
				}

				let startTem = template.globalOffsetToLocal(startGlo)
				let endTem = template.globalOffsetToLocal(endGlo)
				
				for (let change of this.templateService.getFormattingEditsForRange!(template, startTem, endTem, options)) {
					this.translateTextSpan(change.span, template)
					changes.push(change)
				}
			}

			// Merge original formatting edits with template ones.
			return [...callOriginal(), ...changes]
		})
	}

	private wrapGetCodeFixesAtPosition() {
		if (!this.templateService.getCodeFixesAtPosition) {
			return
		}

		this.wrap('getCodeFixesAtPosition', (callOriginal, fileName: string, startGlo: number, endGlo: number, errorCodes: ReadonlyArray<number>, options: TS.FormatCodeSettings, preferences: TS.UserPreferences) => {
			let template = this.templateProvider.getTemplateAt(fileName, startGlo)
			if (!template) {
				return callOriginal()
			}

			let startTem = template.globalOffsetToLocal(startGlo)
			let endTem = template.globalOffsetToLocal(endGlo)

			// Diagnostics are already in global origin, no need to translate.
			let actions = this.templateService.getCodeFixesAtPosition!(template, startTem, endTem, errorCodes, options, preferences)

			// Merge original code fixes with template ones.
			return [
				...callOriginal(),
				...actions,
			]
		})
	}

	private wrapGetSupportedCodeFixes() {
		if (!this.templateService.getSupportedCodeFixes) {
			return
		}

		let callOriginal = ts.getSupportedCodeFixes.bind(ts)

		// Merge original supported code fixes with template ones.
		ts.getSupportedCodeFixes = () => {
			return [
				...callOriginal(),
				...this.templateService.getSupportedCodeFixes!().map(x => String(x)),
			]
		}
	}

	private wrapGetSignatureHelpItemsAtPosition() {
		if (!this.templateService.getSignatureHelpItemsAtPosition) {
			return
		}

		this.wrap('getSignatureHelpItems', (callOriginal, fileName: string, gloOffset: number, options?: TS.SignatureHelpItemsOptions) => {
			let template = this.templateProvider.getTemplateAt(fileName, gloOffset)
			if (!template) {
				return callOriginal()
			}

			let temOffset = template.globalOffsetToLocal(gloOffset)
			let withinValueRange = template.isWithinValueRange(temOffset)
			let items = this.templateService.getSignatureHelpItemsAtPosition!(template, temOffset, gloOffset, options)

			if (items) {
				this.translateTextSpan(items.applicableSpan, template)
			}

			if (withinValueRange && (!items || items.items.length === 0)) {
				return callOriginal()
			}

			// Replace original signature help to template ones.
			return items
		})
	}

	private wrapGetOutliningSpans() {
		if (!this.templateService.getOutliningSpans) {
			return
		}

		this.wrap('getOutliningSpans', (callOriginal, fileName: string) => {
			let spans: TS.OutliningSpan[] = []

			for (let template of this.templateProvider.getAllTemplates(fileName)) {
				for (let outliningSpan of this.templateService.getOutliningSpans!(template)) {
					this.translateTextSpan(outliningSpan.textSpan, template)
					this.translateTextSpan(outliningSpan.hintSpan, template)

					spans.push(outliningSpan)
				}
			}

			// Merge original outlining spans with template ones.
			return [...callOriginal(), ...spans,]
		})
	}

	private wrapGetReferencesAtPosition() {
		if (
			!this.templateService.getReferencesAtPosition
			&& !this.templateService.getSemanticReferencesAtPosition
			&& !this.templateService.augmentReferences
		) {
			return
		}

		this.wrap('findReferences', (callOriginal, fileName: string, gloOffset: number) => {
			let template = this.templateProvider.getTemplateAt(fileName, gloOffset)
			if (!template) {
				let symbols = callOriginal()

				return this.templateService.augmentReferences
					? this.templateService.augmentReferences(symbols)
					: symbols
			}

			let temOffset = template.globalOffsetToLocal(gloOffset)
			let withinValueRange = template.isWithinValueRange(temOffset)

			// Resolves Lupos component, property, or binding symbols.
			let semanticSymbols = this.templateService.getSemanticReferencesAtPosition?.(
				template,
				temOffset,
				gloOffset
			)

			if (semanticSymbols && semanticSymbols.length > 0) {
				return semanticSymbols
			}

			// Resolves generic HTML/CSS document highlighting.
			let symbols = this.templateService.getReferencesAtPosition?.(template, temOffset, gloOffset)
			if (symbols) {
				symbols.forEach(symbol => {
					this.translateTextSpan(symbol.definition.textSpan, template!)

					for (let ref of symbol.references) {
						this.translateTextSpan(ref.textSpan, template!)

						if (ref.contextSpan) {
							this.translateTextSpan(ref.contextSpan, template!)
						}

						if (ref.originalTextSpan) {
							this.translateTextSpan(ref.originalTextSpan, template!)
						}

						if (ref.originalContextSpan) {
							this.translateTextSpan(ref.originalContextSpan, template!)
						}
					}
				})
			}

			// Use original reference service when locate in value range.
			if (withinValueRange && (!symbols || symbols.length === 0)) {
				let originalSymbols = callOriginal()

				return this.templateService.augmentReferences
					? this.templateService.augmentReferences(originalSymbols)
					: originalSymbols
			}

			// Replace original references to template ones.
			return symbols
		})
	}

	private wrapGetRenameInfo() {
		if (!this.templateService.getRenameInfoAtPosition && !this.templateService.modifyRenameInfo) {
			return
		}

		this.wrap('getRenameInfo', (callOriginal, fileName: string, gloOffset: number, preferences) => {
			let template = this.templateProvider.getTemplateAt(fileName, gloOffset)
			if (!template) {
				let info = callOriginal()

				return this.templateService.modifyRenameInfo
					? this.templateService.modifyRenameInfo(fileName, gloOffset, info)
					: info
			}

			let temOffset = template.globalOffsetToLocal(gloOffset)

			// Modify existing rename info and may deny it.
			if (template.isWithinValueRange(temOffset)) {
				let info = callOriginal()

				return this.templateService.modifyRenameInfo
					? this.templateService.modifyRenameInfo(fileName, gloOffset, info)
					: info
			}

			// Get template range rename info.
			let info = this.templateService.getRenameInfoAtPosition!(template, temOffset, preferences)
			if (!info) {
				return callOriginal()
			}

			if (info.canRename) {
				this.translateTextSpan(info.triggerSpan, template)
			}

			return info
		})
	}

	private wrapFindRenameLocations() {
		if (!this.templateService.findRenameLocations && !this.templateService.augmentRenameLocations) {
			return
		}

		this.wrap('findRenameLocations', (
			callOriginal,
			fileName: string,
			gloOffset: number,
			findInStrings: boolean,
			findInComments: boolean,
			preferences
		) => {
			let template = this.templateProvider.getTemplateAt(fileName, gloOffset)
			if (!template) {
				let locations = callOriginal()

				return this.templateService.augmentRenameLocations
					? this.templateService.augmentRenameLocations(fileName, gloOffset, locations)
					: locations
			}

			// Augment rename locations to add location from template.
			let temOffset = template.globalOffsetToLocal(gloOffset)
			if (template.isWithinValueRange(temOffset)) {
				let locations = callOriginal()

				return this.templateService.augmentRenameLocations
					? this.templateService.augmentRenameLocations(fileName, gloOffset, locations)
					: locations
			}

			// Get rename locations directly from template.
			return this.templateService.findRenameLocations!(
				template,
				temOffset,
				findInStrings,
				findInComments,
				preferences
			)
		})
	}

	private wrapGetJsxClosingTagAtPosition() {
		if (!this.templateService.getJsxClosingTagAtPosition) {
			return
		}

		this.wrap('getJsxClosingTagAtPosition', (callOriginal, fileName: string, gloOffset: number) => {
			let template = this.templateProvider.getTemplateAt(fileName, gloOffset)
			if (!template) {
				return callOriginal()
			}

			let temOffset = template.globalOffsetToLocal(gloOffset)
			let withinValueRange = template.isWithinValueRange(temOffset)
			let info = this.templateService.getJsxClosingTagAtPosition!(template, temOffset, gloOffset)

			if (withinValueRange && !info) {
				return callOriginal()
			}

			// Replace original closing tag to template ones.
			return info
		})
	}
}
