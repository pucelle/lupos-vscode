import {ts} from '../core'
import {TemplatePart, TemplatePartLocation, TemplatePartLocationType, TemplatePartType, TemplateSlotPlaceholder} from '../lupos-ts-module'
import type * as TS from 'typescript'


export function getScriptElementKind(
	item: CompletionItem,
	part: TemplatePart | undefined,
	location: TemplatePartLocation
): TS.ScriptElementKind {
	if (!part) {
		return ts.ScriptElementKind.classElement
	}

	switch (part.type) {
		case TemplatePartType.Component:
		case TemplatePartType.DynamicComponent:
			return ts.ScriptElementKind.classElement

		case TemplatePartType.FlowControl:
			return ts.ScriptElementKind.keyword
		
		case TemplatePartType.SlotTag:
		case TemplatePartType.NormalStartTag:

			// For `<|`
			if (!part.node.tagName) {
				if (TemplateSlotPlaceholder.isComponent(item.name)) {
					return ts.ScriptElementKind.classElement
				}
				else if (item.name.startsWith('lu:')) {
					return ts.ScriptElementKind.keyword
				}
			}

			return ts.ScriptElementKind.string
		
		case TemplatePartType.Binding:
			if (location.type === TemplatePartLocationType.Name) {
				return ts.ScriptElementKind.classElement
			}
			else {
				return ts.ScriptElementKind.string
			}
		
		case TemplatePartType.Property:
			if (location.type === TemplatePartLocationType.Name) {
				return ts.ScriptElementKind.memberVariableElement
			}
			else {
				return ts.ScriptElementKind.string
			}

		case TemplatePartType.Event:
			if (location.type === TemplatePartLocationType.Name) {
				return ts.ScriptElementKind.functionElement
			}
			else {
				return ts.ScriptElementKind.string
			}

		case TemplatePartType.SlottedAttribute:
		case TemplatePartType.UnSlottedAttribute:
		case TemplatePartType.QueryAttribute:
			if (location.type === TemplatePartLocationType.Name) {
				return ts.ScriptElementKind.memberVariableElement
			}
			else {
				return ts.ScriptElementKind.string
			}

		default:
			return ts.ScriptElementKind.unknown
	}
}


export function getSymbolDisplayPartKind(part: TemplatePart, location: TemplatePartLocation): TS.SymbolDisplayPartKind {
	switch (part.type) {
		case TemplatePartType.Component:
		case TemplatePartType.DynamicComponent:
		case TemplatePartType.SlotTag:
		case TemplatePartType.FlowControl:
			return ts.SymbolDisplayPartKind.className

		case TemplatePartType.NormalStartTag:
			return ts.SymbolDisplayPartKind.text
	
		case TemplatePartType.Binding:
			if (location.type === TemplatePartLocationType.Name) {
				return ts.SymbolDisplayPartKind.className
			}
			else {
				return ts.SymbolDisplayPartKind.propertyName
			}

		case TemplatePartType.Property:
			if (location.type === TemplatePartLocationType.Name) {
				return ts.SymbolDisplayPartKind.propertyName
			}
			else {
				return ts.SymbolDisplayPartKind.text
			}

		case TemplatePartType.Event:
			if (location.type === TemplatePartLocationType.Name) {
				return ts.SymbolDisplayPartKind.functionName
			}
			else {
				return ts.SymbolDisplayPartKind.text
			}
	
		case TemplatePartType.SlottedAttribute:
		case TemplatePartType.UnSlottedAttribute:
		case TemplatePartType.QueryAttribute:
			if (location.type === TemplatePartLocationType.Name) {
				return ts.SymbolDisplayPartKind.propertyName
			}
			else {
				return ts.SymbolDisplayPartKind.text
			}

		default:
			return ts.SymbolDisplayPartKind.text
	}
}

