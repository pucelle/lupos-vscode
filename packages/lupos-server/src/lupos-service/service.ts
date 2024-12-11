import type * as TS from 'typescript'
import {WorkSpaceAnalyzer} from './analyzer/analyzer'
import {LuposCompletion} from './completion'
import {LuposQuickInfo} from './quickinfo'
import {LuposDefinition} from './definition'
import {Logger, ProjectContext} from '../core'
import {Template} from '../template-service'
import {DiagnosticModifier, getTemplatePartLocationAt, TemplateDiagnostics} from '../lupos-ts-module'


/** Provide lupos language service for a single. */
export class LuposService {

	readonly context: ProjectContext

	private analyzer: WorkSpaceAnalyzer
	private completion: LuposCompletion
	private quickInfo: LuposQuickInfo
	private definition: LuposDefinition
	private diagnostics: TemplateDiagnostics

	constructor(context: ProjectContext) {
		this.context = context
		this.analyzer = new WorkSpaceAnalyzer(context)
		this.completion = new LuposCompletion(this.analyzer)
		this.quickInfo = new LuposQuickInfo(this.analyzer)
		this.definition = new LuposDefinition(this.analyzer)
		this.diagnostics = new TemplateDiagnostics(this.analyzer)
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

		let location = getTemplatePartLocationAt(part, temOffset)
		if (!location) {
			return undefined
		}

		this.beFresh()

		return this.completion.getCompletions(part, location, template)
	}

	getQuickInfo(template: Template, temOffset: number): TS.QuickInfo | undefined {
		let part = template.getPartAt(temOffset)
		if (!part) {
			return undefined
		}

		let location = getTemplatePartLocationAt(part, temOffset)
		if (!location) {
			return undefined
		}

		this.beFresh()
		
		return this.quickInfo.getQuickInfo(part, location, template)
	}

	getDefinition(template: Template, temOffset: number): TS.DefinitionInfoAndBoundSpan | undefined {
		Logger.log(temOffset)
		
		let part = template.getPartAt(temOffset)
		if (!part) {
			return undefined
		}

		Logger.log(part.node.tagName)

		let location = getTemplatePartLocationAt(part, temOffset)
		if (!location) {
			return undefined
		}

		Logger.log(location)

		this.beFresh()
		
		return this.definition.getDefinition(part, location, template)
	}

	modifyDiagnostics(template: Template, modifier: DiagnosticModifier) {
		this.beFresh()
		this.diagnostics.diagnose(template.getAllParts(), template, modifier)
	}
}