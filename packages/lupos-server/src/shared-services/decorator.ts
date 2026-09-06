
// Inspired from https://github.com/microsoft/typescript-template-language-service-decorator


import type TS from 'typescript'
import {Template, TemplateProvider, TemplateLanguageService, TemplateServiceRouter} from '../template-service'
import {ProjectContext, ts} from '../core'
import {DiagnosticModifier} from '../lupos-ts-module'
import {MirrorService} from '../mirror-service'


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

	/** TypeScript language service over project-wide Lupos mirror documents. */
	private mirrorService: MirrorService

	private readonly wrappers: {name: keyof TS.LanguageService, wrapper: LanguageServiceWrapper<any>}[] = []

	constructor(context: ProjectContext) {
		this.context = context
		this.templateProvider = new TemplateProvider(context)
		this.templateService = new TemplateServiceRouter(context)
		this.mirrorService = new MirrorService(context)

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
		this.wrapDispose()
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
			
			let mirrorInfo = withinValueRange
				? this.mirrorService.getCompletionsAtPosition(fileName, gloOffset, options)
				: undefined

			if (info) {
				info.entries.forEach(entry => this.translateTextSpan(entry.replacementSpan, template!))
			}

			info = this.mergeCompletionInfo(info, mirrorInfo)

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

	/** Merge mirror semantic completions with template and HTML catalog entries. */
	private mergeCompletionInfo(
		primary: TS.CompletionInfo | undefined,
		secondary: TS.CompletionInfo | undefined
	): TS.CompletionInfo | undefined {
		if (!primary) {
			return secondary
		}
		else if (!secondary) {
			return primary
		}

		let entries = [...primary.entries]
		let keys = new Set(entries.map(entry => `${entry.name}:${entry.source ?? ''}:${entry.kind}`))

		for (let entry of secondary.entries) {
			let key = `${entry.name}:${entry.source ?? ''}:${entry.kind}`
			if (!keys.has(key)) {
				keys.add(key)
				entries.push(entry)
			}
		}

		return {
			...secondary,
			...primary,
			isGlobalCompletion: primary.isGlobalCompletion || secondary.isGlobalCompletion,
			isMemberCompletion: primary.isMemberCompletion || secondary.isMemberCompletion,
			isNewIdentifierLocation: primary.isNewIdentifierLocation || secondary.isNewIdentifierLocation,
			entries,
		}
	}

	private wrapGetCompletionEntryDetails() {
		if (!this.templateService.getCompletionEntryDetails) {
			return
		}

		this.wrap('getCompletionEntryDetails', (
			callOriginal,
			fileName: string,
			gloOffset: number,
			name: string,
			options,
			source,
			preferences,
			data
		) => {
			let template = this.templateProvider.getTemplateAt(fileName, gloOffset)
			if (!template) {
				return callOriginal()
			}

			// Replace with lupos template completion.
			let temOffset = template.globalOffsetToLocal(gloOffset)
			let withinValueRange = template.isWithinValueRange(temOffset)

			if (withinValueRange) {
				let mirrorEntry = this.mirrorService.getCompletionEntryDetails(
					fileName,
					gloOffset,
					name,
					options,
					source,
					preferences,
					data
				)

				if (mirrorEntry) {
					return mirrorEntry
				}
			}

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

			let mirrorInfo = this.mirrorService.getQuickInfoAtPosition(fileName, gloOffset)
			if (mirrorInfo) {
				return mirrorInfo
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
		this.wrap('getDefinitionAtPosition', (callOriginal, fileName: string, gloOffset: number) => {
			let template = this.templateProvider.getTemplateAt(fileName, gloOffset)
			if (!template) {
				return callOriginal()
			}

			let mirrorDefinitions = this.mirrorService.getDefinitionAtPosition(fileName, gloOffset)
			if (mirrorDefinitions && mirrorDefinitions.length > 0) {
				return [...mirrorDefinitions]
			}

			return callOriginal()
		})
	}

	private wrapGetDefinitionAndBoundSpan() {
		this.wrap('getDefinitionAndBoundSpan', (callOriginal, fileName: string, gloOffset: number) => {
			let template = this.templateProvider.getTemplateAt(fileName, gloOffset)
			if (!template) {
				return callOriginal()
			}

			let mirrorResult = this.mirrorService.getDefinitionAndBoundSpan(fileName, gloOffset)
			if (mirrorResult?.definitions && mirrorResult.definitions.length > 0) {
				return mirrorResult
			}

			return callOriginal()
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
			let diagnostics = this.mirrorService.getSemanticDiagnostics(fileName) ?? callOriginal()

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
			return this.deduplicateDiagnostics(modifier.getModified(diagnostics))
		})
	}

	/** Remove identical diagnostics emitted through overlapping semantic paths. */
	private deduplicateDiagnostics(diagnostics: TS.Diagnostic[]): TS.Diagnostic[] {
		let keys = new Set<string>()

		return diagnostics.filter(diagnostic => {
			let message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')
			let key = `${diagnostic.file?.fileName ?? ''}:${diagnostic.start}:${diagnostic.length}:${diagnostic.code}:${message}`

			if (keys.has(key)) {
				return false
			}

			keys.add(key)
			return true
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

			let mirrorActions = this.mirrorService.getCodeFixesAtPosition(
				fileName,
				startGlo,
				endGlo,
				errorCodes,
				options,
				preferences
			) ?? []

			// Merge original code fixes with template ones.
			return [
				...callOriginal(),
				...mirrorActions,
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

			let mirrorItems = this.mirrorService.getSignatureHelpItems(fileName, gloOffset, options)
			if (mirrorItems) {
				return mirrorItems
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
		this.wrap('findReferences', (callOriginal, fileName: string, gloOffset: number) => {
			let mirrorSymbols = this.mirrorService.findReferences(fileName, gloOffset)
			if (mirrorSymbols && mirrorSymbols.length > 0) {
				return mirrorSymbols
			}

			let template = this.templateProvider.getTemplateAt(fileName, gloOffset)
			if (!template) {
				return callOriginal()
			}

			let temOffset = template.globalOffsetToLocal(gloOffset)
			let withinValueRange = template.isWithinValueRange(temOffset)

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
				return callOriginal()
			}

			// Replace original references to template ones.
			return symbols
		})
	}

	private wrapGetRenameInfo() {
		this.wrap('getRenameInfo', (callOriginal, fileName: string, gloOffset: number, preferences) => {
			let mirrorInfo = this.mirrorService.getRenameInfo(fileName, gloOffset, preferences)
			if (mirrorInfo) {
				return mirrorInfo
			}

			return callOriginal()
		})
	}

	private wrapFindRenameLocations() {
		this.wrap('findRenameLocations', (
			callOriginal,
			fileName: string,
			gloOffset: number,
			findInStrings: boolean,
			findInComments: boolean,
			preferences
		) => {
			let mirrorLocations = this.mirrorService.findRenameLocations(
				fileName,
				gloOffset,
				findInStrings,
				findInComments,
				preferences
			)
			if (mirrorLocations) {
				return mirrorLocations
			}

			let mirrorInfo = this.mirrorService.getRenameInfo(fileName, gloOffset)
			if (mirrorInfo && !mirrorInfo.canRename) {
				return undefined
			}

			return callOriginal()
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

	/** Dispose mirror resources with the decorated TypeScript service. */
	private wrapDispose() {
		this.wrap('dispose', callOriginal => {
			this.mirrorService.dispose()
			return callOriginal()
		})
	}
}
