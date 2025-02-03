
// Inspired from https://github.com/microsoft/typescript-template-language-service-decorator


import type * as TS from 'typescript'
import {Template, TemplateProvider, TemplateLanguageService, TemplateServiceRouter} from '../template-service'
import {ProjectContext, ts} from '../core'
import {DiagnosticModifier} from '../lupos-ts-module'


/** from `(A, B) => C` to `(D: () => C, A, B) => C` */
type LanguageServiceWrapper<K extends keyof TS.LanguageService>
	= TS.LanguageService[K] extends (...args: infer A) => infer R
		? (callOriginal: () => R, ...args: A) => R
		: never

/** Get value of object. */
type ValueOf<O> = O[keyof O]


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
		this.templateService = new TemplateServiceRouter(context)
		this.templateProvider = new TemplateProvider(context)

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
		this.wrapGetJsxClosingTagAtPosition()
	}

	/** Decorate with low level typescript language service. */
	decorate(): TS.LanguageService {
		let rawLanguageService = this.context.service
		let wrappedService: Map<keyof TS.LanguageService, ValueOf<TS.LanguageService>> = new Map()

		for (let {name, wrapper} of this.wrappers) {
			wrappedService.set(name, (...args: any[]) => {
				let rawServiceFn = (rawLanguageService as any)[name]
				let callOriginal = () => rawServiceFn(...args)

				return wrapper(callOriginal, ...args)
			})
		}

		return new Proxy(rawLanguageService, {
			get: (target: any, property: keyof TS.LanguageService) => {
				return wrappedService.get(property) ?? target[property]
			},
		})
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

		this.wrap('getCompletionsAtPosition', (callOriginal, fileName: string, offsetGlo: number, options) => {
			let template = this.templateProvider.getTemplateAt(fileName, offsetGlo)
			if (!template) {
				return callOriginal()
			}

			// Replace with lupos template completion.
			if (this.templateService.getCompletionsAtPosition) {
				let temOffset = template.globalOffsetToLocal(offsetGlo)
				let info = this.templateService.getCompletionsAtPosition!(template, temOffset, options)

				if (info) {
					info.entries.forEach(entry => this.translateTextSpan(entry.replacementSpan, template!))
				}

				return info
			}

			// No original completion.
			return undefined
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

		this.wrap('getCompletionEntryDetails', (callOriginal, fileName: string, offsetGlo: number, name: string, options) => {
			let template = this.templateProvider.getTemplateAt(fileName, offsetGlo)
			if (!template) {
				return callOriginal()
			}

			// Replace with lupos template completion.
			if (this.templateService.getCompletionEntryDetails) {
				let temOffset = template.globalOffsetToLocal(offsetGlo)
				let entry = this.templateService.getCompletionEntryDetails!(template, temOffset, name, options)

				return entry
			}

			return undefined
		})
	}

	private wrapGetQuickInfoAtPosition() {
		if (!this.templateService.getQuickInfoAtPosition) {
			return
		}

		this.wrap('getQuickInfoAtPosition', (callOriginal, fileName: string, offsetGlo: number) => {
			let template = this.templateProvider.getTemplateAt(fileName, offsetGlo)
			if (!template) {
				return callOriginal()
			}
			
			// Replace with lupos template completion.
			if (this.templateService.getCompletionEntryDetails) {
				let temOffset = template.globalOffsetToLocal(offsetGlo)
				let info = this.templateService.getQuickInfoAtPosition!(template, temOffset)

				if (info) {
					this.translateTextSpan(info.textSpan, template)
				}

				return info
			}

			return undefined
		})
	}

	private wrapGetDefinitionAtPosition() {
		if (!this.templateService.getDefinitionAtPosition) {
			return
		}

		this.wrap('getDefinitionAtPosition', (callOriginal, fileName: string, offsetGlo: number) => {
			let template = this.templateProvider.getTemplateAt(fileName, offsetGlo)
			if (!template) {
				return callOriginal()
			}

			// Replace with template definitions.
			let temOffset = template.globalOffsetToLocal(offsetGlo)
			let definitions = this.templateService.getDefinitionAtPosition!(template, temOffset)

			return definitions
		})
	}

	private wrapGetDefinitionAndBoundSpan() {
		if (!this.templateService.getDefinitionAndBoundSpan) {
			return
		}
		
		this.wrap('getDefinitionAndBoundSpan', (callOriginal, fileName: string, offsetGlo: number) => {
			let template = this.templateProvider.getTemplateAt(fileName, offsetGlo)
			if (!template) {
				return callOriginal()
			}

			// Replace with template definitions.
			let temOffset = template.globalOffsetToLocal(offsetGlo)
			let definitionAndSpan = this.templateService.getDefinitionAndBoundSpan!(template, temOffset)

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

				diagnostics.push(...diagnostics)
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

		this.wrap('getSignatureHelpItems', (callOriginal, fileName: string, offsetGlo: number, options?: TS.SignatureHelpItemsOptions) => {
			let template = this.templateProvider.getTemplateAt(fileName, offsetGlo)
			if (!template) {
				return callOriginal()
			}

			let temOffset = template.globalOffsetToLocal(offsetGlo)
			let items = this.templateService.getSignatureHelpItemsAtPosition!(template, temOffset, options)

			if (items) {
				this.translateTextSpan(items.applicableSpan, template)
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
		if (!this.templateService.getReferencesAtPosition) {
			return
		}

		this.wrap('findReferences', (callOriginal, fileName: string, offsetGlo: number) => {
			let template = this.templateProvider.getTemplateAt(fileName, offsetGlo)
			if (!template) {
				return callOriginal()
			}

			let temOffset = template.globalOffsetToLocal(offsetGlo)
			let symbols = this.templateService.getReferencesAtPosition!(template, temOffset)

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

			// Replace original references to template ones.
			return symbols
		})
	}

	private wrapGetJsxClosingTagAtPosition() {
		if (!this.templateService.getJsxClosingTagAtPosition) {
			return
		}

		this.wrap('getJsxClosingTagAtPosition', (callOriginal, fileName: string, offsetGlo: number) => {
			let context = this.templateProvider.getTemplateAt(fileName, offsetGlo)
			if (!context) {
				return callOriginal()
			}

			let temOffset = context.globalOffsetToLocal(offsetGlo)
			let info = this.templateService.getJsxClosingTagAtPosition!(context, temOffset)

			// Replace original closing tag to template ones.
			return info
		})
	}
}
