import type TS from 'typescript'
import {WorkSpaceAnalyzer} from './analyzer/analyzer'
import {LuposCompletion} from './completion'
import {LuposQuickInfo} from './quick-info'
import {ProjectContext} from '../core'
import {Template} from '../template-service'
import {DiagnosticModifier, getTemplatePartPieceAt, TemplateDiagnostics} from '../lupos-ts-module'
import {LuposCodeFixes} from './code-fixes'


/** Provide lupos language service for a single. */
export class LuposService {

	/** Shared project context. */
	readonly context: ProjectContext

	/** Program owning the current analyzer and feature services. */
	private program: TS.Program

	/** Current workspace analyzer. */
	private analyzer!: WorkSpaceAnalyzer

	/** Template completion provider. */
	private completion!: LuposCompletion

	/** Template quick-info provider. */
	private quickInfo!: LuposQuickInfo

	/** Structural template diagnostic provider. */
	private diagnostics!: TemplateDiagnostics

	/** Lupos-specific code-fix provider. */
	private codeFixes!: LuposCodeFixes

	/** Program revision already loaded into the workspace analyzer. */
	private analyzedProgram: TS.Program | null = null

	constructor(context: ProjectContext) {
		this.context = context
		this.program = context.program
		this.initializeServices()
	}

	/** Recreate analyzer-backed services for the current Program and checker. */
	private initializeServices() {
		this.analyzer = new WorkSpaceAnalyzer(this.context)
		this.completion = new LuposCompletion(this.analyzer)
		this.quickInfo = new LuposQuickInfo()
		this.diagnostics = new TemplateDiagnostics(this.analyzer)
		this.codeFixes = new LuposCodeFixes(this.analyzer)
	}

	/** Make sure to reload changed source files. */
	private beFresh() {
		let program = this.context.program
		if (program !== this.program) {
			this.program = program
			this.analyzedProgram = null
			this.initializeServices()
		}

		if (this.analyzedProgram === program) {
			return
		}

		this.analyzer.update()
		this.analyzedProgram = program
	}

	getCompletionInfo(template: Template, temOffset: number): TS.CompletionInfo | undefined {
		let part = template.getPartAt(temOffset)
		if (!part) {
			return undefined
		}

		let piece = getTemplatePartPieceAt(part, temOffset)
		if (!piece) {
			return undefined
		}

		this.beFresh()

		return this.completion.getCompletionInfo(part, piece, template)
	}

	getCompletionEntryDetails(template: Template, temOffset: number, name: string): TS.CompletionEntryDetails | undefined {
		let part = template.getPartAt(temOffset)
		if (!part) {
			return undefined
		}

		let piece = getTemplatePartPieceAt(part, temOffset)
		if (!piece) {
			return undefined
		}

		this.beFresh()

		return this.completion.getCompletionEntryDetails(part, piece, template, name)
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
		
		return this.quickInfo.getQuickInfo(part, piece)
	}

	modifyDiagnostics(template: Template, modifier: DiagnosticModifier) {
		this.beFresh()
		this.diagnostics.diagnoseHTMLSyntax(template, modifier)
		this.diagnostics.diagnoseFunctionContextTemplate(template, modifier)
		this.diagnostics.diagnose(template.parts, template, modifier)
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
