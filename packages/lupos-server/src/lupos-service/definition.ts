import type * as TS from 'typescript'
import {WorkSpaceAnalyzer, LuposItem} from './analyzer'
import {getScriptElementKind} from './utils'
import {Template} from '../template-service'
import {TemplatePart, TemplatePartLocation, TemplatePartLocationType, TemplatePartType} from '../lupos-ts-module'
import {Logger, ProjectContext} from '../core'


/** Provide lupos definition service. */
export class LuposDefinition {

	readonly analyzer: WorkSpaceAnalyzer
	readonly context: ProjectContext

	constructor(analyzer: WorkSpaceAnalyzer) {
		this.analyzer = analyzer
		this.context = analyzer.context
	}
	
	getDefinition(part: TemplatePart, location: TemplatePartLocation, template: Template): TS.DefinitionInfoAndBoundSpan | undefined {
		Logger.log(location)
			
		// `<A`
		if (part.type === TemplatePartType.Component) {
			let component = this.analyzer.getComponentByTagName(part.node.tagName!, template)
			return this.makeDefinitionInfo(component, part, location)
		}

		// :xxx
		else if (part.type === TemplatePartType.Binding) {
			let item = this.getBindingDefinition(part, location, template)
			return this.makeDefinitionInfo(item, part, location)
		}

		// .xxx
		else if (part.type === TemplatePartType.Property) {
			if (location.type === TemplatePartLocationType.Name) {
				let component = this.analyzer.getComponentByTagName(part.node.tagName!, template)
				let property = component ? this.analyzer.getComponentProperty(component, part.mainName!) : undefined

				return this.makeDefinitionInfo(property, part, location)
			}
		}

		// @xxx
		else if (part.type === TemplatePartType.Event) {
			if (location.type === TemplatePartLocationType.Name) {
				let component = this.analyzer.getComponentByTagName(part.node.tagName!, template)
				let event = component ? this.analyzer.getComponentEvent(component, part.mainName!) : undefined
				return this.makeDefinitionInfo(event, part, location)
			}
		}

		return undefined
	}
	
	private getBindingDefinition(part: TemplatePart, location: TemplatePartLocation, template: Template) {
		let attr = part.attr!
		let mainName = part.mainName!

		// `:name|`, complete binding name.
		if (location.type === TemplatePartLocationType.Name) {
			let binding = this.analyzer.getBindingByName(mainName, template)
			return binding
		}
		
		// If `:slot="|"`.
		else if (location.type === TemplatePartLocationType.Modifier) {
			if (mainName === 'slot') {
				let attrValue = attr.value!
				let component = this.analyzer.getComponentByTagName(part.node.tagName!, template)
				let property = component ? this.analyzer.getComponentSubProperties(component, 'slotElements', attrValue) : undefined

				return property
			}
		}

		return undefined
	}

	private makeDefinitionInfo(item: LuposItem | undefined, part: TemplatePart, location: TemplatePartLocation): TS.DefinitionInfoAndBoundSpan | undefined{
		if (!item) {
			return undefined
		}

		let nameNode = item.nameNode
		let name = item.name
		let kind = getScriptElementKind(item, part, location)
		let fileName = nameNode.getSourceFile().fileName

		let textSpan: TS.TextSpan = {
			start: nameNode.getStart(),
			length: nameNode.getWidth(),
		}

		let info: TS.DefinitionInfo = {
			textSpan,
			fileName,
			kind,
			name,
			containerName: fileName,
			containerKind: this.context.helper.ts.ScriptElementKind.scriptElement,
		}

		// Not include modifiers.
		let length = location.end - location.start

		let fromTextSpan = {
			start: location.start,
			length,
		}

		return {
			definitions: [info],
			textSpan: fromTextSpan,
		}
	}
}