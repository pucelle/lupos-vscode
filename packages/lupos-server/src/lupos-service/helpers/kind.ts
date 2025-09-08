import {CompletionItem} from '../../complete-data'
import {ts} from '../../core'
import {TemplatePart, TemplatePartPiece, TemplatePartPieceType, TemplatePartType, TemplateSlotPlaceholder} from '../../lupos-ts-module'
import type * as TS from 'typescript'
import {DefinitionItem} from './definition-converter'
import {QuickInfoItem} from './quick-info-converter'


/** For completion. */
export function getScriptElementKind(
	item: CompletionItem | DefinitionItem | QuickInfoItem,
	part: TemplatePart | undefined,
	piece: TemplatePartPiece
): TS.ScriptElementKind {
	if (!part) {
		return ts.ScriptElementKind.classElement
	}

	if (item.kind !== undefined) {
		return item.kind
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
			if (piece.type === TemplatePartPieceType.Name) {
				return ts.ScriptElementKind.classElement
			}
			else {
				return ts.ScriptElementKind.string
			}
		
		case TemplatePartType.Property:
			if (piece.type === TemplatePartPieceType.Name) {
				return ts.ScriptElementKind.memberVariableElement
			}
			else {
				return ts.ScriptElementKind.string
			}

		case TemplatePartType.Event:
			if (piece.type === TemplatePartPieceType.Name) {
				return ts.ScriptElementKind.functionElement
			}
			else {
				return ts.ScriptElementKind.string
			}

		case TemplatePartType.SlottedAttribute:
		case TemplatePartType.UnSlottedAttribute:
		case TemplatePartType.QueryAttribute:
			if (piece.type === TemplatePartPieceType.Name) {
				return ts.ScriptElementKind.memberVariableElement
			}
			else {
				return ts.ScriptElementKind.string
			}

		default:
			return ts.ScriptElementKind.unknown
	}
}


/** For quick info. */
export function getSymbolDisplayPartKind(part: TemplatePart, piece: TemplatePartPiece): TS.SymbolDisplayPartKind {
	switch (part.type) {
		case TemplatePartType.Component:
		case TemplatePartType.DynamicComponent:
		case TemplatePartType.SlotTag:
		case TemplatePartType.FlowControl:
			return ts.SymbolDisplayPartKind.className

		case TemplatePartType.NormalStartTag:
			return ts.SymbolDisplayPartKind.text
	
		case TemplatePartType.Binding:
			if (piece.type === TemplatePartPieceType.Name) {
				return ts.SymbolDisplayPartKind.className
			}
			else {
				return ts.SymbolDisplayPartKind.propertyName
			}

		case TemplatePartType.Property:
			if (piece.type === TemplatePartPieceType.Name) {
				return ts.SymbolDisplayPartKind.propertyName
			}
			else {
				return ts.SymbolDisplayPartKind.text
			}

		case TemplatePartType.Event:
			
			// DOM element event will be overwritten outside.
			if (piece.type === TemplatePartPieceType.Name) {
				return ts.SymbolDisplayPartKind.functionName
			}
			else {
				return ts.SymbolDisplayPartKind.text
			}
	
		case TemplatePartType.SlottedAttribute:
		case TemplatePartType.UnSlottedAttribute:
		case TemplatePartType.QueryAttribute:
			if (piece.type === TemplatePartPieceType.Name) {
				return ts.SymbolDisplayPartKind.propertyName
			}
			else {
				return ts.SymbolDisplayPartKind.text
			}

		default:
			return ts.SymbolDisplayPartKind.text
	}
}
