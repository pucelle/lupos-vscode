import type * as TS from 'typescript'
import {ts} from '../../../core'
import {Helper, ObjectLike} from '../../../lupos-ts-module'


interface MemberType{
	member: TS.ClassElement | TS.TypeElement
	type: TS.TypeNode | undefined
}

interface MemberTypeItem {
	node: TS.Node
	member: TS.ClassElement | TS.TypeElement | undefined
	type: TS.TypeNode | undefined
	possibleTypes: Map<string, MemberType>
}


/** 
 * When editing descendant property of an object, and knows the type of this object,
 * here want to infer the sibling members of editing property.
 * Normally for completion.
 */
export function inferMemberType(node: TS.Identifier, rootNode: TS.Expression, rootType: TS.TypeNode, helper: Helper): MemberTypeItem | null {
	for (let pair of walkMemberTypeItems(rootNode, rootType, helper)) {
		if (pair.node === node) {
			return pair
		}
	}

	return null
}


function* walkMemberTypeItems(node: TS.Node, type: TS.TypeNode, helper: Helper): Iterable<MemberTypeItem> {
	
	// {a, ...}
	if (ts.isObjectLiteralExpression(node)) {

		let objectLikeListResolved = helper.isObjectLike(type) ? [type]
			: helper.symbol.resolveDeclarations(type, helper.isObjectLike)

		if (objectLikeListResolved && objectLikeListResolved.length > 0) {
			let nodeMap = propertyMapOfObjectLiteral(node, helper)
			let typeMap = typeNodeMapOfObjectLikeList(objectLikeListResolved, helper)

			for (let key of nodeMap.keys()) {
				let subNode = nodeMap.get(key)!
				let subType = typeMap.get(key)

				yield {
					node: subNode,
					type: subType?.type,
					member: subType?.member,
					possibleTypes: typeMap,
				}

				if (subType?.type) {
					yield* walkMemberTypeItems(subNode, subType.type, helper)
				}
			}
		}
	}

	// [a, b, ...c]
	else if (ts.isArrayLiteralExpression(node)) {
		let {list, rest} = helper.variable.decomposeArrayLiteralList(node)

		// `[T, T]`
		if (ts.isTupleTypeNode(type)) {
			for (let i = 0; i < list.length; i++) {
				let item = list[i]
				let subType = i < type.elements.length ? type.elements[i] : undefined

				if (subType) {
					yield* walkMemberTypeItems(item, subType, helper)
				}
			}
		}

		// `T[]`
		else if (ts.isArrayTypeNode(type)) {
			for (let item of list) {
				yield* walkMemberTypeItems(item, type.elementType, helper)
			}
		}

		// `Array<T>`
		else if (ts.isTypeReferenceNode(type)) {
			let name = helper.types.getTypeNodeReferenceName(type)
			if ((name === 'Array' || name === 'ReadonlyArray')
				&& type.typeArguments?.length === 1
			) {
				for (let item of list) {
					yield* walkMemberTypeItems(item, type.typeArguments[0], helper)
				}
			}
		}

		for (let restItem of rest) {
			yield* walkMemberTypeItems(restItem, type, helper)
		}
	}
}


function propertyMapOfObjectLiteral(object: TS.ObjectLiteralExpression, helper: Helper): Map<string, TS.Expression> {
	let map: Map<string, TS.Expression> = new Map()

	for (let prop of object.properties) {
		let name = prop.name
		if (!name) {
			continue
		}

		let nameText = helper.getText(name)
		let value: TS.Expression | undefined

		// {a: 1}
		if (ts.isPropertyAssignment(prop)) {
			value = prop.initializer
		}

		// {a}
		else if (ts.isShorthandPropertyAssignment(prop)) {
			value = prop.name
		}
		
		if (value) {
			map.set(nameText, value)
		}
	}

	return map
}


function typeNodeMapOfObjectLikeList(objects: ObjectLike[], helper: Helper): Map<string, MemberType> {
	let map: Map<string, MemberType> = new Map()

	for (let object of objects) {
		let sub = typeNodeMapOfObjectLike(object, helper)
		for (let [key, value] of sub) {
			map.set(key, value)
		}
	}

	return map
}


function typeNodeMapOfObjectLike(object: ObjectLike, helper: Helper): Map<string, MemberType> {
	let map: Map<string, MemberType> = new Map()

	for (let member of helper.objectLike.walkMembers(object, true, false)) {
		let name = member.name
		if (!name) {
			continue
		}

		let nameText = helper.getText(name)

		// {a: number}
		let type = helper.types.getTypeNode(member)

		if (type && !map.has(nameText)) {
			map.set(nameText, {
				type,
				member
			})
		}
	}

	return map
}