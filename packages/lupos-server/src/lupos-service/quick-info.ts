import type TS from 'typescript'
import {DOMBooleanAttributes, DOMElementEvents, DOMStyleProperties, CompletionItem} from '../complete-data'
import {TemplatePart, TemplatePartPiece, TemplatePartPieceType, isSimulatedEventName, TemplatePartType, TemplateSlotPlaceholder, LUPOS_BINDING_MODIFIERS, LUPOS_COMPONENT_ATTRIBUTES, LUPOS_DOM_EVENT_MODIFIERS, LUPOS_DOM_EVENT_CATEGORIES, LUPOS_SIMULATED_EVENTS, LUPOS_FLOW_CONTROL_TAGS,} from '../lupos-ts-module'
import {makeQuickInfo} from './helpers/quick-info-converter'


/** Provide lupos quickinfo service. */
export class LuposQuickInfo {

	getQuickInfo(part: TemplatePart, piece: TemplatePartPiece): TS.QuickInfo | undefined {
		let item: CompletionItem | undefined

		// <lu:xxx>
		if (part.type === TemplatePartType.FlowControl) {
			let info = LUPOS_FLOW_CONTROL_TAGS.find(item => item.name === part.node.tagName)
			item = info
		}

		// :xxx.modifier
		else if (part.type === TemplatePartType.Binding) {
			item = this.getBindingModifierQuickInfo(part, piece)
		}

		// ?xxx
		else if (part.type === TemplatePartType.QueryAttribute) {
			let property = findBooleanAttributeQuickInfo(part.mainName!, part.node.tagName!)
			item = property
		}

		// @xxx
		else if (part.type === TemplatePartType.Event) {
			let event = this.getEventQuickInfo(part, piece)
			item = event
		}

		// `tagName="xxx"`
		else if (part.type === TemplatePartType.UnSlottedAttribute
			&& TemplateSlotPlaceholder.isComponent(part.node.tagName!)
			&& piece.type === TemplatePartPieceType.Name
		) {
			let info = LUPOS_COMPONENT_ATTRIBUTES.find(item => item.name === part.mainName)
			item = info
		}

		if (!item) {
			return undefined
		}

		return makeQuickInfo(item, part, piece)
	}
	
	private getBindingModifierQuickInfo(part: TemplatePart, piece: TemplatePartPiece) {
		if (piece.type !== TemplatePartPieceType.Modifier) {
			return undefined
		}

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
				return findQuickInfoItem(LUPOS_BINDING_MODIFIERS.style, modifierValue)
			}
		}

		// Not `:style`
		else {
			let modifierItems = LUPOS_BINDING_MODIFIERS[mainName]
			if (modifierItems) {
				return findQuickInfoItem(modifierItems, modifierValue)
			}
		}

		return undefined
	}

	private getEventQuickInfo(part: TemplatePart, piece: TemplatePartPiece) {
		let mainName = part.mainName!
		let isSimulatedEvent = isSimulatedEventName(mainName)

		// `@cli|`, find quick info of event name.
		if (piece.type === TemplatePartPieceType.Name) {
			if (isSimulatedEvent) {
				return findQuickInfoItem(LUPOS_SIMULATED_EVENTS, mainName)
			}
			else {
				return findQuickInfoItem(DOMElementEvents, mainName)
			}
		}

		// `@click.`, find quick info of modifiers.
		else if (piece.type === TemplatePartPieceType.Modifier) {

			// `@keydown.Enter`, `@click.left`.
			if (LUPOS_DOM_EVENT_CATEGORIES[mainName]) {
				let category = LUPOS_DOM_EVENT_CATEGORIES[mainName]
				return findQuickInfoItem(LUPOS_DOM_EVENT_MODIFIERS[category], piece.name)
			}

			// `@click.prevent`.
			else {
				return findQuickInfoItem(LUPOS_DOM_EVENT_MODIFIERS.global, piece.name)
			}
		}

		return undefined
	}
}


function findQuickInfoItem(items: CompletionItem[], label: string): CompletionItem | undefined {
	return items.find(item => item.name === label) || undefined
}

function findBooleanAttributeQuickInfo(label: string, tagName: string): CompletionItem | undefined {
	return DOMBooleanAttributes.find(item => {
		if (item.forElements && !item.forElements.includes(tagName)) {
			return false
		}

		return item.name.startsWith(label)
	})
}
