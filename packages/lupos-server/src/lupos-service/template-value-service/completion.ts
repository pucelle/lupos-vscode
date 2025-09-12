import {Helper, TemplatePart, TemplatePartPiece} from '../../lupos-ts-module'
import {Template} from '../../template-service'
import {inferMemberType} from './helpers/infer-member-type'
import {WorkSpaceAnalyzer} from '../analyzer'
import {CompletionItem} from '../../complete-data'
import {inferTemplateValueMember, TemplateValueMemberInferred} from './infer-member'


/** Get complete for template value, typescript part. */
export function getTemplateValueCompletionItems(
	part: TemplatePart,
	piece: TemplatePartPiece,
	template: Template,
	gloOffset: number,
	analyzer: WorkSpaceAnalyzer
): CompletionItem[] | undefined {
	let helper = analyzer.helper
	let node = template.getNodeAtOffset(gloOffset)
	let inferred = inferTemplateValueMember(part, piece, template, node, analyzer)

	if (inferred) {
		return getMemberCompletionItems(inferred, helper)
	}

	return undefined
}


function getMemberCompletionItems(inferred: TemplateValueMemberInferred, helper: Helper): CompletionItem[] | undefined {
	let {node, valueNode, valueType, template} = inferred
	let ts = helper.ts

	let memberType = inferMemberType(node, valueNode, valueType, helper)
	if (!memberType) {
		return undefined
	}

	// Completed the property name.
	if (memberType.type) {
		return undefined
	}

	let lowerNodeText = helper.getText(node).toLowerCase()
	let items: CompletionItem[] = []

	for (let [name, mt] of memberType.possibleMembers) {
		let lowerKey = name.toLowerCase()

		if (!lowerKey.startsWith(lowerNodeText)) {
			continue
		}

		let type = mt.type ? helper.types.typeOfTypeNode(mt.type) : undefined
		let typeText = type ? helper.types.getTypeFullText(type) : 'any'
		let detail = `${name}: ${typeText}`
		let description = helper.getNodeDescription(mt.member) ?? ''
		let start = template.globalOffsetToLocal(node.getStart())
		let end = template.globalOffsetToLocal(node.getEnd())

		let item: CompletionItem = {
			name: name,
			kind: ts.ScriptElementKind.memberVariableElement,
			start,
			end,
			detail,
			description,
		}

		items.push(item)
	}
	
	return items
}
