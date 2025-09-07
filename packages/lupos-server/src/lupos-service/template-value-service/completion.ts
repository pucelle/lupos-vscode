import type * as TS from 'typescript'
import {Helper, TemplatePart, TemplatePartPiece, TemplatePartPieceType, TemplatePartType} from '../../lupos-ts-module'
import {Template} from '../../template-service'
import {inferMemberType} from './helpers/infer-member-type'
import {WorkSpaceAnalyzer} from '../analyzer'
import {CompletionItem} from '../../complete-data'


/** Get complete for template value, typescript part. */
export function getTemplateValueCompletionItems(
	part: TemplatePart,
	piece: TemplatePartPiece,
	template: Template,
	temOffset: number,
	analyzer: WorkSpaceAnalyzer
): CompletionItem[] {
	let helper = analyzer.helper
	let ts = helper.ts

	if (part.type === TemplatePartType.Property && piece.type === TemplatePartPieceType.AttrValue) {
		let node = template.getNodeAtOffset(temOffset)
		if (!node || !ts.isIdentifier(node)) {
			return []
		}

		return getComponentPropertyCompletionItems(template, part, node, analyzer) ?? []
	}

	else if (part.type === TemplatePartType.Binding && piece.type === TemplatePartPieceType.AttrValue) {
		let node = template.getNodeAtOffset(temOffset)
		if (!node || !ts.isIdentifier(node)) {
			return []
		}

		return getBindingParameterCompletion(template, part, node, analyzer) ?? []
	}

	return []
}


function getComponentPropertyCompletionItems(
	template: Template,
	part: TemplatePart,
	node: TS.Identifier,
	analyzer: WorkSpaceAnalyzer
): CompletionItem[] | null {

	let helper = analyzer.helper
	let mainName = part.mainName!
	let tagName = part.node.tagName!

	let component = analyzer.getComponentByTagName(tagName, template)
	let property = component ? analyzer.getComponentProperty(component, mainName) : null

	// `.property=${...}`
	if (!component || !property) {
		return null
	}

	let propertyDecl = property.declaration
	let propertyType = helper.types.getTypeNode(propertyDecl)
	let valueNode = template.getPartUniqueValue(part)

	if (!propertyType || !valueNode) {
		return null
	}

	return inferCompletionItems(node, valueNode, propertyType, template, helper)
}


function inferCompletionItems(
	node: TS.Identifier,
	valueNode: TS.Expression,
	valueType: TS.TypeNode,
	template: Template,
	helper: Helper
): CompletionItem[] | null {
	let ts = helper.ts

	let memberType = inferMemberType(node, valueNode, valueType, helper)
	if (!memberType) {
		return null
	}

	// Completed the property name.
	if (memberType.type) {
		return null
	}

	let lowerNodeText = helper.getText(node).toLowerCase()
	let items: CompletionItem[] = []

	for (let [key, mt] of memberType.possibleTypes) {
		let lowerKey = key.toLowerCase()

		if (!lowerKey.startsWith(lowerNodeText)) {
			continue
		}

		let type = mt.type ? helper.types.typeOfTypeNode(mt.type) : undefined
		let typeText = type ? helper.types.getTypeFullText(type) : 'any'
		let detail = `${typeText}`
		let description = helper.getNodeDescription(mt.member) ?? ''
		let start = template.globalOffsetToLocal(node.getStart())
		let end = template.globalOffsetToLocal(node.getEnd())

		let item: CompletionItem = {
			name: key,
			detail,
			description,
			kind: ts.ScriptElementKind.memberVariableElement,
			start,
			end
		}

		items.push(item)
	}
	
	return items
}



export function getBindingParameterCompletion(
	template: Template,
	part: TemplatePart,
	node: TS.Identifier,
	analyzer: WorkSpaceAnalyzer
) {

	let helper = template.helper
	let ts = helper.ts
	let mainName = part.mainName!

	let binding = analyzer.getBindingByName(mainName, template)
	if (!binding) {
		return null
	}

	let updateMethod = helper.class.getMethod(binding.declaration, 'update', true)
	if (!updateMethod) {
		return
	}

	let parameters = updateMethod.parameters
	let valueNode = template.getPartUniqueValue(part)
	if (!valueNode) {
		return null
	}

	// `?:binding=${a, b}`, `?:binding=${(a, b)}`
	if (ts.isParenthesizedExpression(valueNode)) {
		valueNode = valueNode.expression
	}

	let valueNodes = helper.pack.unPackCommaBinaryExpressions(valueNode)

	// First value decides whether binding should be activated.
	if (part.namePrefix === '?:') {
		valueNodes = valueNodes.slice(1)
	}

	let valueIndex = valueNodes.findIndex(n => n.getStart() <= node.getStart() && n.getEnd() >= node.getEnd())
	if (valueIndex === -1) {
		return null
	}

	valueNode = valueNodes[valueIndex]
	let parameter = parameters[valueIndex]
	if (!parameter || !parameter.type) {
		return null
	}

	return inferCompletionItems(node, valueNode, parameter.type, template, helper)
}