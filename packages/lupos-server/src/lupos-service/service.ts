import type * as TS from 'typescript'
import {WorkSpaceAnalyzer} from './analyzer/analyzer'
import {LuposCompletion} from './completion'
import {LuposQuickInfo} from './quickinfo'
import {LuposDefinition} from './definition'
import {ProjectContext} from '../core'
import {Template} from '../template-service'
import {DiagnosticModifier, getTemplatePartPieceAt, TemplateDiagnostics} from '../lupos-ts-module'
import {LuposCodeFixes} from './code-fixes'


/** Provide lupos language service for a single. */
export class LuposService {

	readonly context: ProjectContext

	private analyzer: WorkSpaceAnalyzer
	private completion: LuposCompletion
	private quickInfo: LuposQuickInfo
	private definition: LuposDefinition
	private diagnostics: TemplateDiagnostics
	private codeFixes: LuposCodeFixes

	constructor(context: ProjectContext) {
		this.context = context
		this.analyzer = new WorkSpaceAnalyzer(context)
		this.completion = new LuposCompletion(this.analyzer)
		this.quickInfo = new LuposQuickInfo(this.analyzer)
		this.definition = new LuposDefinition(this.analyzer)
		this.diagnostics = new TemplateDiagnostics(this.analyzer)
		this.codeFixes = new LuposCodeFixes(this.analyzer)
	}

	/** Make sure to reload changed source files. */
	private beFresh() {
		this.analyzer.update()
	}

	getCompletions(template: Template, temOffset: number): TS.CompletionInfo | undefined {
		let part = template.getPartAt(temOffset)
		if (!part) {
			return undefined
		}

		let piece = getTemplatePartPieceAt(part, temOffset)
		if (!piece) {
			return undefined
		}

		this.beFresh()

		return this.completion.getCompletions(part, piece, template)
	}

	getQuickInfo(template: Template, temOffset: number): TS.QuickInfo | undefined {
		let part = template.getPartAt(temOffset)
		if (!part) {
			return undefined
		}

		let piece = getTemplatePartPieceAt(part, temOffset)
		if (!piece) {
			return undefined
		}

		this.beFresh()
		
		return this.quickInfo.getQuickInfo(part, piece, template)
	}

	getDefinition(template: Template, temOffset: number): TS.DefinitionInfoAndBoundSpan | undefined {
		let part = template.getPartAt(temOffset)
		if (!part) {
			return undefined
		}

		let piece = getTemplatePartPieceAt(part, temOffset)
		if (!piece) {
			return undefined
		}

		this.beFresh()
		
		return this.definition.getDefinition(part, piece, template)
	}

	modifyDiagnostics(template: Template, modifier: DiagnosticModifier) {
		this.beFresh()
		this.diagnostics.diagnose(template.getAllParts(), template, modifier)
	}

	getCodeFixesAtPosition(template: Template, temOffset: number, errorCodes: ReadonlyArray<number>): TS.CodeFixAction[] | undefined {
		let part = template.getPartAt(temOffset)
		if (!part) {
			return undefined
		}

		let piece = getTemplatePartPieceAt(part, temOffset)
		if (!piece) {
			return undefined
		}

		this.beFresh()

		return this.codeFixes.getCodeFixes(part, piece, template, errorCodes)
	}
}