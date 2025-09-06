import type * as TS from 'typescript'
import {TemplatePart, TemplatePartPiece, TemplatePartPieceType, TemplatePartType} from '../../lupos-ts-module'
import {Template} from '../../template-service'
import {inferMemberType} from './helpers/infer-member-type'
import {WorkSpaceAnalyzer} from '../analyzer'
import {CompletionItem} from '../../complete-data'


/** Get complete for template value, typescript part. */
export function getTemplateValueCompletions(
	part: TemplatePart,
	piece: TemplatePartPiece,
	template: Template,
	temOffset: number,
	analyzer: WorkSpaceAnalyzer
): CompletionItem[] {
	let helper = analyzer.helper
	let ts = helper.ts

	if (part.type === TemplatePartType.Property) {
		if (piece.type === TemplatePartPieceType.AttrValue) {
			let node = template.getNodeAtOffset(temOffset)
			if (!node || !ts.isIdentifier(node)) {
				return []
			}

			return getComponentPropertyCompletion(template, part, node, analyzer) ?? []
		}
	}

	return []
}


function getComponentPropertyCompletion(
	template: Template,
	part: TemplatePart,
	node: TS.Identifier,
	analyzer: WorkSpaceAnalyzer
): CompletionItem[] | null {

	let helper = analyzer.helper
	let ts = helper.ts
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

	let memberType = inferMemberType(node, valueNode, propertyType, helper)
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

		let item: CompletionItem = {
			name: key,
			detail,
			description,
			kind: ts.ScriptElementKind.memberVariableElement,
			node,
		}

		items.push(item)
	}
	
	return items
}



// export function diagnoseBinding(
// 	piece: TemplatePartPiece,
// 	part: TemplatePart,
// 	template: TemplateBasis,
// 	modifier: DiagnosticModifier,
// 	analyzer: Analyzer
// ) {
// 	let start = template.localOffsetToGlobal(piece.start)
// 	let length = template.localOffsetToGlobal(piece.end) - start
// 	let helper = template.helper
// 	let types = helper.types
// 	let ts = helper.ts
// 	let mainName = part.mainName!
// 	let modifiers = part.modifiers!

// 	if (piece.type === TemplatePartPieceType.Name) {
// 		let ref = template.getReferenceByName(mainName)
// 		if (ref) {
// 			modifier.deleteNeverReadFromNodeExtended(ref)
// 		}

// 		let binding = analyzer.getBindingByName(mainName, template)
// 		if (!binding && !LuposKnownInternalBindings[mainName]) {
// 			modifier.add(start, length, DiagnosticCode.MissingImportOrDeclaration, `Binding class "${mainName}" is not imported or declared.`)
// 			return
// 		}
// 	}

// 	else if (piece.type === TemplatePartPieceType.Modifier) {
// 		let modifierIndex = piece.modifierIndex!
// 		let modifierText = modifiers[modifierIndex]

// 		if (mainName === 'class') {
// 			if (modifierIndex > 0) {
// 				modifier.add(start, length, DiagnosticCode.NotAssignable, `Modifier "${modifierText}" is not allowed, only one modifier as class name can be specified.`)
// 				return
// 			}
// 		}
// 		else if (mainName === 'style') {
// 			if (modifierIndex > 1) {
// 				modifier.add(start, length, DiagnosticCode.NotAssignable, `Modifier "${modifierText}" is not allowed, at most two modifiers can be specified for ":style".`)
// 				return
// 			}

// 			if (modifierIndex === 1 && !LuposBindingModifiers.style.find(item => item.name === modifierText)) {
// 				modifier.add(start, length, DiagnosticCode.NotAssignable, `Modifier "${modifierText}" is not allowed, it must be one of "${LuposBindingModifiers.style.map(item => item.name).join(', ')}".`)
// 				return
// 			}
// 		}
// 		else if (LuposBindingModifiers[mainName]) {
// 			if (!LuposBindingModifiers[mainName].find(item => item.name === modifierText)) {
// 				modifier.add(start, length, DiagnosticCode.NotAssignable, `Modifier "${modifierText}" is not allowed, it must be one of "${LuposBindingModifiers[mainName].map(item => item.name).join(', ')}".`)
// 				return
// 			}
// 		}
// 		else {
// 			let binding = analyzer.getBindingByName(mainName, template)
// 			if (binding) {
// 				let bindingClassParams = helper.class.getConstructorParameters(binding.declaration, true)
// 				let modifiersParamType = bindingClassParams && bindingClassParams.length === 3 ? bindingClassParams[2].type : null
				
// 				let availableModifiers = modifiersParamType ?
// 					types.splitUnionTypeToStringList(types.typeOfTypeNode(modifiersParamType)!)
// 					: null

// 				if (availableModifiers && availableModifiers.length > 0) {
// 					if (!availableModifiers.find(name => name === modifierText)) {
// 						modifier.add(start, length, DiagnosticCode.NotAssignable, `Modifier "${modifierText}" is not allowed, it must be one of "${availableModifiers.join(', ')}".`)
// 						return
// 					}
// 				}
// 			}
// 		}
// 	}

// 	else if (piece.type === TemplatePartPieceType.AttrValue) {
// 		let valueNodes: (TS.Expression | null)[] = [null]
// 		let valueTypes = [template.getPartValueType(part)]

// 		// `?:binding=${a, b}`, `?:binding=${(a, b)}`
// 		if (!part.strings && part.valueIndices) {
// 			let valueNode = template.valueNodes[part.valueIndices[0].index]

// 			if (ts.isParenthesizedExpression(valueNode)) {
// 				valueNode = valueNode.expression
// 			}

// 			let splittedValueNodes = helper.pack.unPackCommaBinaryExpressions(valueNode)
			
// 			valueNodes = splittedValueNodes
// 			valueTypes = splittedValueNodes.map(node => types.typeOf(node))

// 			// First value decides whether binding should be activated.
// 			if (part.namePrefix === '?:') {
// 				valueNodes = splittedValueNodes.slice(1)
// 				valueTypes = valueTypes.slice(1)
// 			}

// 			// May unused comma expression of a for `${a, b}`, here remove it.
// 			if (splittedValueNodes.length > 1) {
// 				for (let i = 0; i < splittedValueNodes.length - 1; i++) {
// 					modifier.deleteOfNode(splittedValueNodes[i], [DiagnosticCode.UnUsedComma])
// 				}
// 			}
// 		}

// 		// Currently we are not able to build a function type dynamically,
// 		// so can't test whether parameters match binding update method.

// 		let binding = analyzer.getBindingByName(mainName, template)
// 		if (binding) {
// 			if (mainName === 'class') {
// 				diagnoseClassUpdateParameter(binding, valueNodes, valueTypes, start, length, part, template, modifier)
// 			}
// 			else if (mainName === 'style') {
// 				diagnoseStyleUpdateParameter(binding, valueNodes, valueTypes, start, length, part, template, modifier)
// 			}
// 			else if (mainName === 'ref') {}
// 			else {
// 				diagnoseOtherUpdateParameter(binding, valueNodes, valueTypes, start, length, template, modifier)
// 			}
// 		}
// 	}
// }