import type * as TS from 'typescript'
import {LuposAnalyzer} from './analyzer/analyzer'
import {LuposCompletion} from './completion'
import {LuposQuickInfo} from './quickinfo'
import {LuposDefinition} from './definition'
import {ProjectContext} from '../core'
import {Template} from '../template-service'
import {getTemplatePartLocation} from '../lupos-ts-module'


/** Provide lupos language service for a single. */
export class LuposService {

	readonly context: ProjectContext

	private analyzer: LuposAnalyzer
	private completion: LuposCompletion
	private quickInfo: LuposQuickInfo
	private definition: LuposDefinition

	constructor(context: ProjectContext) {
		this.context = context
		this.analyzer = new LuposAnalyzer(context)
		this.completion = new LuposCompletion(this.analyzer)
		this.quickInfo = new LuposQuickInfo(this.analyzer)
		this.definition = new LuposDefinition(this.analyzer)
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

		let location = getTemplatePartLocation(part, temOffset)
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

		let location = getTemplatePartLocation(part, temOffset)
		if (!location) {
			return undefined
		}

		this.beFresh()
		
		return this.quickInfo.getQuickInfo(part, location, template)
	}

	getDefinition(template: Template, temOffset: number): TS.DefinitionInfoAndBoundSpan | undefined {
		let part = template.getPartAt(temOffset)
		if (!part) {
			return undefined
		}

		let location = getTemplatePartLocation(part, temOffset)
		if (!location) {
			return undefined
		}

		this.beFresh()
		
		return this.definition.getDefinition(part, location, template)
	}
}