import type * as TS from 'typescript'
import {LuposComponent, LuposEvent, LuposProperty} from './types'
import {Helper} from '../../lupos-ts-module'
import {ts} from '../../core'


/** Walk and Discover all lupos components from a given node and it's children. */
export function analyzeLuposComponents(sourceFile: TS.SourceFile, helper: Helper): LuposComponent[] {
	let components: LuposComponent[] = []

	// Only visit root class declarations.
	ts.forEachChild(sourceFile, (node: TS.Node) => {
		if (ts.isClassDeclaration(node)
			&& node.name
			&& helper.class.isDerivedOf(node, 'Component', '@pucelle/lupos.js')
		) {
			components.push(createLuposComponent(node, helper))
		}
	})

	return components
}


/** Can use it to create custom object. */
export function createLuposComponent(node: TS.ClassDeclaration, helper: Helper): LuposComponent {
	let properties: Record<string, LuposProperty> = {}
	let events: Record<string, LuposEvent> = {}
	let refs: Record<string, LuposProperty> = {}
	let slotElements: Record<string, LuposProperty> = {}

	for (let event of analyzeLuposComponentEvents(node, helper)) {
		events[event.name] = event
	}

	for (let property of analyzeLuposComponentProperties(node, helper)) {
		properties[property.name] = property
	}

	for (let ref of analyzeLuposComponentSubProperties(node, 'refs', helper) || []) {
		refs[ref.name] = ref
	}

	for (let slot of analyzeLuposComponentSubProperties(node, 'slotElements', helper) || []) {
		slotElements[slot.name] = slot
	}
	
	return {
		name: node.name!.text,
		nameNode: node.name!,
		declaration: node,
		type: helper.types.typeOf(node),
		description: helper.getNodeDescription(node) || '',
		sourceFile: node.getSourceFile(),
		properties,
		events,
		slotElements,
	}
}


/** Analyze event interfaces from `extends Component<XXXEvents>`. */
export function analyzeLuposComponentEvents(component: TS.ClassDeclaration, helper: Helper): LuposEvent[] {
	let events: LuposEvent[] = []

	// Resolve all the event interface items.
	let interfaceDecls = helper.symbol.resolveExtendedInterfaceLikeTypeParameters(component, 'EventFirer', 0)

	for (let decl of interfaceDecls) {
		for (let member of decl.members) {
			if (!ts.isPropertySignature(member)) {
				continue
			}

			if (!member.name) {
				continue
			}

			events.push({
				name: member.name.getText(),
				nameNode: member.name,
				type: helper.types.typeOf(member)!,
				description: helper.getNodeDescription(member) || '',
				sourceFile: component.getSourceFile(),
			})
		}
	}

	return events
}



/** Analyze public properties from class. */
export function analyzeLuposComponentProperties(declaration: TS.ClassLikeDeclaration, helper: Helper): LuposProperty[] {
	let properties: LuposProperty[] = []

	for (let member of declaration.members) {
		let property = analyzeLuposComponentMemberProperty(member, helper)
		if (property) {
			properties.push(property)
		}
	}

	return properties
}


/** Matches class properties from child nodes of a class declaration node. */
function analyzeLuposComponentMemberProperty(node: TS.ClassElement, helper: Helper): LuposProperty | null {

	// `class {property = value, property: type = value}`, property must be public and not readonly.
	if (ts.isPropertyDeclaration(node) || ts.isPropertySignature(node)) {
		let beReadOnly = helper.class.hasModifier(node, 'readonly')
		let bePublic = helper.class.getVisibility(node) === 'public'
		let beStatic = helper.class.hasModifier(node, 'static')

		if (!beReadOnly && !beStatic) {
			return {
				name: node.name.getText(),
				nameNode: node,
				type: helper.types.typeOf(node),
				description: helper.getNodeDescription(node) || '',
				sourceFile: node.getSourceFile(),
				public: bePublic,
			}
		}
	}

	// `class {set property(value)}`
	else if (ts.isSetAccessor(node)) {
		let firstParameter = node.parameters?.[0]
		let type = helper.types.typeOf(firstParameter || node)
		let bePublic = helper.class.getVisibility(node) === 'public'
		let beStatic = helper.class.hasModifier(node, 'static')

		if (!beStatic) {
			return{
				name: node.name.getText(),
				nameNode: node,
				type,
				description: helper.getNodeDescription(node) || '',
				sourceFile: node.getSourceFile(),
				public: bePublic,
			}
		}
	}

	return null
}


/** Analyze sub properties from class, like `refs` or slots. */
export function analyzeLuposComponentSubProperties(component: TS.ClassLikeDeclaration, propertyName: string, helper: Helper): LuposProperty[] | null {
	let properties: LuposProperty[] | null = null
	let member = helper.class.getProperty(component, propertyName)
	
	if (!member) {
		return null
	}

	let typeNode = member.getChildren().find(child => ts.isTypeNode(child))
	if (!typeNode) {
		return null
	}
	
	// refs: {...}
	if (!ts.isTypeLiteralNode(typeNode)) {
		return null
	}

	properties = []

	for (let typeMember of typeNode.members) {
		if (!ts.isPropertySignature(typeMember)) {
			continue
		}
		
		let property: LuposProperty = {
			name: typeMember.name.getText(),
			nameNode: typeMember,
			type: helper.types.typeOf(typeMember),
			description: helper.getNodeDescription(typeMember) || '',
			sourceFile: typeMember.getSourceFile(),
			public: true,
		}

		properties.push(property)
	}

	return properties
}
