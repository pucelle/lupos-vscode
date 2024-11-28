import * as ts from 'typescript'
import {discoverFlitBindings as discoverLuposBindings, discoverLuposComponents, getFlitDefinedFromComponentDeclaration} from './components'
import {analyzeLuposComponentEvents} from './events'
import {discoverFlitProperties, discoverFlitSubProperties} from './discover-flit-properties'
import {iterateExtendedClasses, resolveExtendedClasses} from '../../ts-utils/_ast-utils'
import {discoverFlitIcons, FlitIcon} from './discover-flit-icons'
import {ProjectContext} from '../../core'
import {LuposBinding, LuposComponent, LuposProperty} from './types'
import {ListMap} from '../../lupos-ts-module'


export class LuposAnalyzer {

	readonly context: ProjectContext

	/** Latest analyzed source files. */
	private files: Set<ts.SourceFile> = new Set()

	/** Analyzed components. */
	private components: Set<LuposComponent> = new Set()

	/** Analyzed components by name. */
	private componentsByName: ListMap<string, LuposComponent> = new ListMap()

	/** Analyzed bindings. */
	private bindings: Set<LuposBinding> = new Set()

	/** Analyzed bindings by name. */
	private bindingsByName: ListMap<string, LuposBinding> = new ListMap()

	/** All imported icons. */
	private icons: Map<string, FlitIcon> = new Map()

	constructor(context: ProjectContext) {
		this.context = context
	}

	/** Update to make sure reloading changed source files. */
	update() {
		let changedFiles = this.compareFiles()

		for (let file of changedFiles) {
			this.analysisTSFile(file)
		}
	}

	/** Compare files, returned changed or not analyzed files, always exclude `lib.???.d.ts`. */
	private compareFiles() {

		// Exclude typescript lib files.
		let allFiles = new Set(
			this.context.program.getSourceFiles()
				.filter(file => !this.context.helper.symbol.isOfTypescriptLib(file))
		)

		// Not analyzed files.
		let changedFiles: Set<ts.SourceFile> = new Set()

		// Analyzed but have been deleted files.
		let expiredFiles: Set<ts.SourceFile> = new Set()

		for (let file of allFiles) {
			if (!this.files.has(file)) {
				changedFiles.add(file)
			}
		}

		for (let file of this.files) {
			if (!allFiles.has(file)) {
				expiredFiles.add(file)
			}
		}

		this.makeFilesExpire(expiredFiles)
		this.files = allFiles

		return changedFiles
	}

	/** Make parsed results in given files expired. */
	private makeFilesExpire(files: Set<ts.SourceFile>) {

		// Defined component expired.
		for (let component of [...this.components]) {
			if (!files.has(component.sourceFile)) {
				continue
			}

			this.components.delete(component)
			this.componentsByName.delete(component.name, component)
		}

		// Binding expired.
		for (let binding of this.bindings) {
			if (!files.has(binding.sourceFile)) {
				continue
			}

			this.bindings.delete(binding)
			this.bindingsByName.delete(binding.name, binding)
		}
	}

	/** Analysis each ts file. */
	private analysisTSFile(sourceFile: ts.SourceFile) {
		let components = discoverLuposComponents(sourceFile, this.typeChecker)
		let bindings = discoverLuposBindings(sourceFile, this.typeChecker)
		let icons = discoverFlitIcons(sourceFile)

		// `@define ...` results will always cover others. 
		for (let component of components) {
			this.analysisComponent(component)
		}
	
		for (let binding of bindings) {
			this.bindings.set(binding.name, binding)

			mayDebug(() => ({
				name: binding.name,
				description: binding.description,
			}))
		}

		for (let icon of icons) {
			this.icons.set(icon.name, icon)
		}

		if (icons.length > 0) {
			mayDebug(() => {
				return icons.map(i => ({
					name: i.name,
					description: i.description,
				}))
			})
		}
	}

	/** Analysis one base component result. */
	private analysisComponent(defined: FlitDefined) {
		let declaration = defined.declaration
		let properties: Map<string, LuposProperty> = new Map()
		let events: Map<string, FlitEvent> = new Map()
		let refs: Map<string, LuposProperty> = new Map()
		let slots: Map<string, LuposProperty> = new Map()

		for (let property of discoverFlitProperties(declaration, this.typeChecker)) {
			properties.set(property.name, property)
		}

		for (let event of analyzeLuposComponentEvents(declaration, this.typeChecker)) {
			events.set(event.name, event)
		}

		for (let ref of discoverFlitSubProperties(declaration, 'refs', this.typeChecker) || []) {
			refs.set(ref.name, ref)
		}

		for (let slot of discoverFlitSubProperties(declaration, 'slots', this.typeChecker) || []) {
			slots.set(slot.name, slot)
		}
		
		// Heriatages to be analysised later, so we will analysis `@define ...`, and then super class.
		let component = {
			...defined,
			properties,
			events,
			refs,
			slots,
			extended: [],
		} as LuposComponent

		if (declaration.heritageClauses && declaration.heritageClauses?.length > 0) {
			this.extendedClassNotResolvedComponents.add(component)
		}

		mayDebug(() => ({
			name: component.name,
			superClasses: [...iterateExtendedClasses(component.declaration, this.typeChecker)].map(n => n.declaration.name?.getText()),
			properties: [...component.properties.values()].map(p => p.name),
			events: [...component.events.values()].map(e => e.name),
			refs: [...component.refs.values()].map(e => e.name),
			slots: [...component.slots.values()].map(e => e.name),
		}))
		
		this.components.set(declaration, component)
	}

	/** Analysis extended classes and returns result. */
	private getExtendedClasses(declaration: ts.ClassLikeDeclaration) {
		let extended: LuposComponent[] = []
		let classesWithType = resolveExtendedClasses(declaration, this.typeChecker)

		if (classesWithType) {
			for (let declaration of classesWithType.map(v => v.declaration)) {
				let superClass = this.getAnalysisedSuperClass(declaration)
				if (superClass) {
					extended.push(superClass)
				}
			}
		}

		return extended
	}

	/** Makesure component analysised and returns result. */
	private getAnalysisedSuperClass(declaration: ts.ClassLikeDeclaration): LuposComponent | null {
		if (!this.components.has(declaration)) {
			let defined = getFlitDefinedFromComponentDeclaration(declaration, this.typeChecker)
			if (defined) {
				this.analysisComponent(defined)
			}
		}

		return this.components.get(declaration) || null
	}

	/** Get component by it's tag name. */
	getComponent(name: string): LuposComponent | null {
		let component = [...this.components.values()].find(component => component.name === name)
		return component || null
	}

	/** Get component by it's class declaration. */
	getComponentByDeclaration(declaration: ts.ClassLikeDeclaration): LuposComponent | null {
		return this.components.get(declaration) || null
	}

	/** Get bindings that name matches. */
	getBinding(name: string): LuposBinding | null {
		for (let binding of this.bindings.values()) {
			if (binding.name === name) {
				return binding
			}
		}

		return null
	}

	/** Get properties for component defined with `tagName`, and name matches. */
	getComponentProperty(propertyName: string, tagName: string): LuposProperty | null {
		let component = this.getComponent(tagName)
		if (!component) {
			return null
		}
	
		for (let com of this.walkComponents(component)) {
			for (let property of com.properties.values()) {
				if (property.name === propertyName) {
					return property
				}
			}
		}

		return null
	}

	/** Get events for component defined with `tagName`, and name matches. */
	getComponentEvent(name: string, tagName: string): FlitEvent | null {
		let component = this.getComponent(tagName)
		if (!component) {
			return null
		}

		for (let com of this.walkComponents(component)) {
			for (let event of com.events.values()) {
				if (event.name === name) {
					return event
				}
			}
		}

		return null
	}

	/** Get all refs or slots properties outer class declaration contains given node. */
	getSubProperties(propertyName: 'refs' | 'slots', subPropertyName: string, tagName: string): LuposProperty | null {
		let component = this.getComponent(tagName)
		if (!component) {
			return null
		}

		for (let com of this.walkComponents(component)) {
			for (let property of com[propertyName].values()) {
				if (property.name === subPropertyName) {
					return property
				}
			}
		}

		return null
	}

	/** Get a icon from it's defined file name. */
	getIcon(name: string): FlitIcon | null {
		return this.icons.get(name) || null
	}



	/** Get components that name starts with label. */
	getComponentsForCompletion(label: string): LuposComponent[] {
		let components: LuposComponent[] = []

		for (let component of this.components.values()) {
			if (component.name?.startsWith(label)) {
				components.push(component)
			}
		}

		return components
	}

	/** Get bindings that name starts with label. */
	getBindingsForCompletion(label: string): LuposBinding[] {
		let bindings: LuposBinding[] = []

		for (let binding of this.bindings.values()) {
			if (binding.name.startsWith(label)) {
				bindings.push(binding)
			}
		}

		return bindings
	}

	/** Get properties for component defined with `tagName`, and name starts with label. */
	getComponentPropertiesForCompletion(label: string, tagName: string, mustBePublic = true): LuposProperty[] | null {
		let component = this.getComponent(tagName)
		if (!component) {
			return null
		}
		
		let properties: Map<string, LuposProperty> = new Map()

		for (let com of this.walkComponents(component)) {
			for (let property of com.properties.values()) {
				if (mustBePublic && !property.public) {
					continue
				}
				
				if (property.name.startsWith(label) && !properties.has(property.name)) {
					properties.set(property.name, property)
				}
			}
		}

		return [...properties.values()]
	}

	/** Walk component and it's super classes. */
	private *walkComponents(component: LuposComponent, deep = 0): Generator<LuposComponent> {
		yield component

		for (let superClass of component.extended) {
			yield *this.walkComponents(superClass, deep + 1)
		}
	}

	/** Get events for component defined with `tagName`, and name starts with label. */
	getComponentEventsForCompletion(label: string, tagName: string): FlitEvent[] | null {
		let component = this.getComponent(tagName)
		if (!component) {
			return null
		}

		let events: Map<string, FlitEvent> = new Map()

		for (let com of this.walkComponents(component)) {
			for (let event of com.events.values()) {
				if (event.name.startsWith(label) && !events.has(event.name)) {
					events.set(event.name, event)
				}
			}
		}

		return [...events.values()]
	}

	/** Get all refs or slots properties outer class declaration contains given node. */
	getSubPropertiesForCompletion(propertyName: 'refs' | 'slots', subPropertyNameLabel: string, tagName: string): LuposProperty[] | null {
		let component = this.getComponent(tagName)
		if (!component) {
			return null
		}

		let properties: Map<string, LuposProperty> = new Map()

		for (let com of this.walkComponents(component)) {
			for (let property of com[propertyName].values()) {
				if (property.name.startsWith(subPropertyNameLabel) && !properties.has(property.name)) {
					properties.set(property.name, property)
				}
			}
		}

		return [...properties.values()]
	}

	/** Get a icon when it's defined file name matches label. */
	getIconsForCompletion(label: string): FlitIcon[] {
		return [...this.icons.values()].filter(icon => icon.name.startsWith(label))
	}
}