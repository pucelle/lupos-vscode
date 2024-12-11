import type * as TS from 'typescript'
import {WorkSpaceAnalyzer} from './analyzer'
import {getScriptElementKind, getSymbolDisplayPartKind} from './utils'
import {DOMBooleanAttributes, DOMElementEvents, DOMStyleProperties, CompletionItem} from '../complete-data'
import {TemplatePart, TemplatePartLocation, TemplatePartLocationType, isSimulatedEventName, TemplatePartType, TemplateSlotPlaceholder, LuposBindingModifiers, LuposComponentAttributes, LuposDOMEventModifiers, LuposDOMEventCategories, LuposSimulatedEvents,} from '../lupos-ts-module'
import {Template} from '../template-service'
import {ProjectContext} from '../core'


interface QuickInfoItem extends CompletionItem {
	type?: TS.Type
}


/** Provide lupos quickinfo service. */
export class LuposQuickInfo {

	readonly analyzer: WorkSpaceAnalyzer
	readonly context: ProjectContext

	constructor(analyzer: WorkSpaceAnalyzer) {
		this.analyzer = analyzer
		this.context = analyzer.context
	}
	
	/** `offset` is the local offset relative to part start. */
	getQuickInfo(part: TemplatePart, location: TemplatePartLocation, template: Template): TS.QuickInfo | undefined {

		// `<A`
		if (part.type === TemplatePartType.Component) {
			let component = this.analyzer.getComponentByTagName(part.node.tagName!, template)
			return this.makeQuickInfo(component, part, location)
		}

		// :xxx
		else if (part.type === TemplatePartType.Binding) {
			let item = this.getBindingQuickInfo(part, location, template)
			return this.makeQuickInfo(item, part, location)
		}

		// .xxx
		else if (part.type === TemplatePartType.Property) {
			if (location.type === TemplatePartLocationType.Name) {
				let component = this.analyzer.getComponentByTagName(part.node.tagName!, template)
				let property = component ? this.analyzer.getComponentProperty(component, part.mainName!) : undefined

				return this.makeQuickInfo(property, part, location)
			}
		}

		// ?xxx
		else if (part.type === TemplatePartType.QueryAttribute) {
			let property = findBooleanAttributeQuickInfo(part.mainName!, part.node.tagName!)
			return this.makeQuickInfo(property, part, location)
		}

		// @xxx
		else if (part.type === TemplatePartType.Event) {
			let event = this.getEventQuickInfo(part, location, template)
			return this.makeQuickInfo(event, part, location)
		}

		// `tagName="xxx"`
		else if (part.type === TemplatePartType.UnSlottedAttribute
			&& TemplateSlotPlaceholder.isComponent(part.node.tagName!)
			&& location.type === TemplatePartLocationType.Name
		) {
			let info = LuposComponentAttributes.find(item => item.name === part.mainName)
			if (info) {
				return this.makeQuickInfo(info, part, location)
			}
		}

		return undefined
	}
	
	private getBindingQuickInfo(part: TemplatePart, location: TemplatePartLocation, template: Template) {
		let mainName = part.mainName!

		// `:name|`, quick info of binding name.
		if (location.type === TemplatePartLocationType.Name) {
			let binding = this.analyzer.getBindingByName(mainName, template)
			return binding
		}

		// `:ref.|`, quick info of modifiers.
		else if (location.type === TemplatePartLocationType.Modifier) {
			return this.getBindingModifierQuickInfo(part, location)
		}

		// `:slot="|"`.
		else if (location.type === TemplatePartLocationType.AttrValue) {
			return this.getBindingAttrValueQuickInfo(part, template)
		}

		return undefined
	}

	private getBindingModifierQuickInfo(part: TemplatePart, location: TemplatePartLocation) {
		let modifiers = part.modifiers!
		let mainName = part.mainName!
		let modifierIndex = location.modifierIndex!
		let modifierValue = modifiers[modifierIndex]

		// `:style`
		if (mainName === 'style') {

			// Complete style property.
			if (modifierIndex === 0) {
				return findQuickInfoItem(DOMStyleProperties, modifierValue)
			}

			// Complete style unit.
			else if (modifierIndex === 1) {
				return findQuickInfoItem(LuposBindingModifiers.style, modifierValue)
			}
		}

		// Not `:style`
		else {
			let modifierItems = LuposBindingModifiers[mainName]
			if (modifierItems) {
				return findQuickInfoItem(modifierItems, modifierValue)
			}
		}

		return undefined
	}

	// `:slot="|"`.
	private getBindingAttrValueQuickInfo(part: TemplatePart, template: Template) {
		let attr = part.attr!
		let mainName = part.mainName!
		let attrValue = attr.value!

		// :slot="|name"
		if (['slot'].includes(mainName) && template.component) {
			let currentComponent = this.analyzer.getComponentByDeclaration(template.component)!
			let propertyItems = this.analyzer.getSubPropertiesForCompletion(currentComponent, 'slotElements', attrValue)

			return findQuickInfoItem(propertyItems, attrValue)
		}

		return undefined
	}

	private getEventQuickInfo(part: TemplatePart, location: TemplatePartLocation, template: Template) {
		let mainName = part.mainName!
		let tagName = part.node.tagName!
		let isComponent = TemplateSlotPlaceholder.isComponent(tagName)
		let isSimulatedEvent = isSimulatedEventName(mainName)
		let component = isComponent ? this.analyzer.getComponentByTagName(tagName, template) : null
		let componentEvents = component ? this.analyzer.getComponentEventsForCompletion(component, mainName) : null

		// `@cli|`, find quick info of event name.
		if (location.type === TemplatePartLocationType.Name) {
			if (isSimulatedEvent) {
				return findQuickInfoItem(LuposSimulatedEvents, mainName)
			}
			else if (componentEvents && componentEvents.length > 0) {
				return findQuickInfoItem(componentEvents, mainName)
			}
			else {
				return findQuickInfoItem(DOMElementEvents, mainName)
			}
		}

		// `@click.`, find quick info of modifiers.
		else if (location.type === TemplatePartLocationType.Modifier) {

			// `@keydown.Enter`, `@click.left`.
			if (LuposDOMEventCategories[mainName]) {
				let category = LuposDOMEventCategories[mainName]
				return findQuickInfoItem(LuposDOMEventModifiers[category], mainName)
			}
		}

		return undefined
	}

	private makeQuickInfo(item: QuickInfoItem | undefined, part: TemplatePart, location: TemplatePartLocation): TS.QuickInfo | undefined{
		if (!item || (!item.type && !item.description)) {
			return undefined
		}

		let kind = getScriptElementKind(item, part, location)

		let textSpan: TS.TextSpan = {
			start: part.start,
			length: part.end - part.start,
		}

		let headers: TS.SymbolDisplayPart[] = []
		let documentation: TS.SymbolDisplayPart[] = []

		let headerText = location.type === TemplatePartLocationType.TagName
			? part.node.tagName!
			: (part.namePrefix || '') + part.mainName!

		if (part.type === TemplatePartType.Component) {
			headerText = '<' + headerText + '>'
		}
		else if (item.type) {
			headerText += ': ' + this.context.helper.types.getTypeFullText(item.type)
		}

		headers.push({
			kind: this.context.helper.ts.SymbolDisplayPartKind[getSymbolDisplayPartKind(part, location)],
			text: headerText,
		})

		if (item.description) {
			documentation.push({
				kind: 'text',
				text: item.description,
			})
		}

		let info: TS.QuickInfo = {
			kind,
			kindModifiers: '',
			textSpan,
			displayParts: headers,
			documentation,
		}

		return info
	}
}


function findQuickInfoItem(items: QuickInfoItem[], label: string): QuickInfoItem | undefined {
	return items.find(item => item.name === label) || undefined
}

function findBooleanAttributeQuickInfo(label: string, tagName: string): QuickInfoItem | undefined {
	return DOMBooleanAttributes.find(item => {
		if (item.forElements && !item.forElements.includes(tagName)) {
			return false
		}

		return item.name.startsWith(label)
	})
}
