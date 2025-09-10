import type * as TS from 'typescript'
import {WorkSpaceAnalyzer} from './analyzer'
import {DOMBooleanAttributes, DOMElementEvents, DOMStyleProperties, CompletionItem} from '../complete-data'
import {TemplatePart, TemplatePartPiece, TemplatePartPieceType, isSimulatedEventName, TemplatePartType, TemplateSlotPlaceholder, LuposBindingModifiers, LuposComponentAttributes, LuposDOMEventModifiers, LuposDOMEventCategories, LuposSimulatedEvents, LuposFlowControlTags,} from '../lupos-ts-module'
import {Template} from '../template-service'
import {ProjectContext} from '../core'
import {getTemplateValueQuickInfoItem} from './template-value-service/quick-info'
import {makeQuickInfo} from './helpers/quick-info-converter'


interface QuickInfoItem extends CompletionItem {
	nameNode?: TS.Node
}


/** Provide lupos quickinfo service. */
export class LuposQuickInfo {

	readonly analyzer: WorkSpaceAnalyzer
	readonly context: ProjectContext

	constructor(analyzer: WorkSpaceAnalyzer) {
		this.analyzer = analyzer
		this.context = analyzer.context
	}
	
	getQuickInfo(part: TemplatePart, piece: TemplatePartPiece, template: Template, temOffset: number): TS.QuickInfo | undefined {
		let item: QuickInfoItem | undefined

		// `<A`
		if (part.type === TemplatePartType.Component) {
			let component = this.analyzer.getComponentByTagName(part.node.tagName!, template)
			item = component
		}

		// <lu:xxx>
		else if (part.type === TemplatePartType.FlowControl) {
			let info = LuposFlowControlTags.find(item => item.name === part.node.tagName)
			item = info
		}

		// :xxx
		else if (part.type === TemplatePartType.Binding) {
			let binding = this.getBindingQuickInfo(part, piece, template)
			item = binding
		}

		// .xxx
		else if (part.type === TemplatePartType.Property) {
			if (piece.type === TemplatePartPieceType.Name) {
				let component = this.analyzer.getComponentByTagName(part.node.tagName!, template)
				let property = component ? this.analyzer.getComponentProperty(component, part.mainName!) : undefined

				item = property
			}
		}

		// ?xxx
		else if (part.type === TemplatePartType.QueryAttribute) {
			let property = findBooleanAttributeQuickInfo(part.mainName!, part.node.tagName!)
			item = property
		}

		// @xxx
		else if (part.type === TemplatePartType.Event) {
			let event = this.getEventQuickInfo(part, piece, template)
			item = event
		}

		// `tagName="xxx"`
		else if (part.type === TemplatePartType.UnSlottedAttribute
			&& TemplateSlotPlaceholder.isComponent(part.node.tagName!)
			&& piece.type === TemplatePartPieceType.Name
		) {
			let info = LuposComponentAttributes.find(item => item.name === part.mainName)
			item = info
		}

		// `.value=${{property}}`, goto definition for `property.`
		if (!item) {
			item = getTemplateValueQuickInfoItem(part, piece, template, temOffset, this.analyzer)
		}

		if (!item) {
			return undefined
		}

		return makeQuickInfo(item, part, piece, this.context.helper)
	}
	
	private getBindingQuickInfo(part: TemplatePart, piece: TemplatePartPiece, template: Template) {
		let mainName = part.mainName!

		// `:name|`, quick info of binding name.
		if (piece.type === TemplatePartPieceType.Name) {
			let binding = this.analyzer.getBindingByName(mainName, template)
			return binding
		}

		// `:ref.|`, quick info of modifiers.
		else if (piece.type === TemplatePartPieceType.Modifier) {
			return this.getBindingModifierQuickInfo(part, piece)
		}

		// `:slot="|"`.
		else if (piece.type === TemplatePartPieceType.AttrValue) {
			return this.getBindingAttrValueQuickInfo(part, template)
		}

		return undefined
	}

	private getBindingModifierQuickInfo(part: TemplatePart, piece: TemplatePartPiece) {
		let modifiers = part.modifiers!
		let mainName = part.mainName!
		let modifierIndex = piece.modifierIndex!
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

	private getEventQuickInfo(part: TemplatePart, piece: TemplatePartPiece, template: Template) {
		let mainName = part.mainName!
		let tagName = part.node.tagName!
		let isComponent = TemplateSlotPlaceholder.isComponent(tagName)
		let isSimulatedEvent = isSimulatedEventName(mainName)
		let component = isComponent ? this.analyzer.getComponentByTagName(tagName, template) : null
		let componentEvents = component ? this.analyzer.getComponentEventsForCompletion(component, mainName) : null

		// `@cli|`, find quick info of event name.
		if (piece.type === TemplatePartPieceType.Name) {
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
		else if (piece.type === TemplatePartPieceType.Modifier) {

			// `@keydown.Enter`, `@click.left`.
			if (LuposDOMEventCategories[mainName]) {
				let category = LuposDOMEventCategories[mainName]
				return findQuickInfoItem(LuposDOMEventModifiers[category], mainName)
			}
		}

		return undefined
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
