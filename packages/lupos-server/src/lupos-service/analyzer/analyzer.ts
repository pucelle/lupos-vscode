import * as TS from 'typescript'
import {analyzeLuposComponents, createLuposComponent} from './components'
import {analyzeLuposIcons, LuposIcon} from './icons'
import {ProjectContext, ts} from '../../core'
import {LuposBinding, LuposComponent, LuposEvent, LuposProperty} from './types'
import {KnownInternalBindings, ListMap, TemplateHelpers} from '../../lupos-ts-module'
import {analyzeLuposBindings, createLuposBinding} from './bindings'
import {Template} from '../../template-service'


export class LuposAnalyzer {

	readonly context: ProjectContext

	/** Latest analyzed source files. */
	private files: Set<TS.SourceFile> = new Set()

	/** Analyzed components. */
	private components: Set<LuposComponent> = new Set()

	/** Analyzed components by source file. */
	private componentsByFile: ListMap<TS.SourceFile, LuposComponent> = new ListMap()

	/** Analyzed components by name. */
	private componentsByName: ListMap<string, LuposComponent> = new ListMap()

	/** Analyzed bindings. */
	private bindings: Set<LuposBinding> = new Set()

	/** Analyzed bindings by name. */
	private bindingsByName: ListMap<string, LuposBinding> = new ListMap()

	/** Analyzed bindings by source file. */
	private bindingsByFile: ListMap<TS.SourceFile, LuposBinding> = new ListMap()

	/** All imported icons. */
	private icons: Map<string, LuposIcon> = new Map()

	constructor(context: ProjectContext) {
		this.context = context
	}

	/** Update to make sure reloading changed source files. */
	update() {
		let changedFiles = this.compareFiles()

		for (let file of changedFiles) {
			this.analyzeTSFile(file)
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
		let changedFiles: Set<TS.SourceFile> = new Set()

		// Analyzed but have been deleted files.
		let expiredFiles: Set<TS.SourceFile> = new Set()

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
	private makeFilesExpire(files: Set<TS.SourceFile>) {

		// Defined component expired.
		for (let component of [...this.components]) {
			if (!files.has(component.sourceFile)) {
				continue
			}

			this.components.delete(component)
			this.componentsByName.delete(component.name, component)
			this.componentsByFile.delete(component.sourceFile, component)
		}

		// Binding expired.
		for (let binding of this.bindings) {
			if (!files.has(binding.sourceFile)) {
				continue
			}

			this.bindings.delete(binding)
			this.bindingsByName.delete(binding.name, binding)
			this.bindingsByFile.delete(binding.sourceFile, binding)
		}
	}

	/** Analyze each ts source file. */
	private analyzeTSFile(sourceFile: TS.SourceFile) {
		let components = analyzeLuposComponents(sourceFile, this.context.helper)
		let bindings = analyzeLuposBindings(sourceFile, this.context.helper)
		let icons = analyzeLuposIcons(sourceFile, this.context.helper)

		this.files.add(sourceFile)

		for (let component of components) {
			this.components.add(component)
			this.componentsByName.add(component.name, component)
			this.componentsByFile.add(component.sourceFile, component)
		}
	
		for (let binding of bindings) {
			this.bindings.add(binding)
			this.bindingsByName.add(binding.name, binding)
			this.bindingsByFile.add(binding.sourceFile, binding)
		}

		for (let icon of icons) {
			this.icons.set(icon.name, icon)
		}
	}

	/** Get components by name. */
	getComponentsByName(name: string): LuposComponent[] | undefined {
		return this.componentsByName.get(name)
	}

	/** Get components by template part, the  and template. */
	getComponentsByTagName(tagName: string, template: Template): LuposComponent[] {
		let classDecls = TemplateHelpers.resolveComponentDeclarations(
			tagName,
			template.node,
			template.valueNodes,
			template.scopeTree,
			this.context.helper
		)

		let components: LuposComponent[] = []
		
		for (let decl of classDecls) {
			let component = this.getComponentByDeclaration(decl)
			if (component) {
				components.push(component)
			}
		}

		return components
	}

	/** 
	 * Get component by it's class declaration, use it for completion.
	 * `declaration` can also be a any level local declaration.
	 */
	getComponentByDeclaration(declaration: TS.ClassDeclaration): LuposComponent | undefined {
		let sourceFile = declaration.getSourceFile()

		// Ensure analyzed source file.
		if (!this.files.has(sourceFile)) {
			this.analyzeTSFile(sourceFile)
		}

		if (declaration.parent !== sourceFile) {
			return createLuposComponent(declaration, this.context.helper)
		}

		let components = this.componentsByFile.get(sourceFile)
		if (components) {
			return components?.find(c => c.declaration === declaration)
		}

		return undefined
	}

	/** 
	 * Get components that name starts with label.
	 * label` can be empty, then will return all components.
	 */
	getComponentsForCompletion(label: string): LuposComponent[] {
		let components: LuposComponent[] = []

		for (let component of this.components) {
			if (!label || component.name.startsWith(label)) {
				components.push(component)
			}
		}

		return components
	}

	/** Walk component and it's super classes. */
	private *walkComponents(component: LuposComponent, deep = 0): Generator<LuposComponent> {
		yield component

		for (let superClass of this.context.helper.class.walkSuper(component.declaration)) {
			let superComponent = this.getComponentByDeclaration(superClass)
			if (!superComponent) {
				continue
			}

			yield superComponent
			yield *this.walkComponents(superComponent, deep + 1)
		}
	}

	/** Get properties of a component. */
	getComponentProperty(component: LuposComponent, propertyName: string): LuposProperty | undefined {
		for (let com of this.walkComponents(component)) {
			if (com.properties[propertyName]) {
				return com.properties[propertyName]
			}
		}

		return undefined
	}

	/** Get all refs or slots properties outer class declaration contains given node. */
	getComponentSubProperties(component: LuposComponent, propertyName: 'slotElements', subPropertyName: string): LuposProperty | undefined {
		for (let com of this.walkComponents(component)) {
			if (com[propertyName][subPropertyName]) {
				return com[propertyName][subPropertyName]
			}
		}

		return undefined
	}

	/** 
	 * Get properties for component, and name starts with label.
	 * `label` can be empty, then will return all properties.
	 */
	getComponentPropertiesForCompletion(component: LuposComponent, label: string, mustBePublic: boolean = true): LuposProperty[] {
		let properties: Map<string, LuposProperty> = new Map()

		for (let com of this.walkComponents(component)) {
			for (let property of Object.values(com.properties)) {
				if (mustBePublic && !property.public) {
					continue
				}

				if (properties.has(property.name)) {
					continue
				}
				
				if (label || property.name.startsWith(label)) {
					properties.set(property.name, property)
				}
			}
		}

		return [...properties.values()]
	}

	/** 
	 * Get all refs or slots properties outer class declaration contains given node.
	 * `label` can be empty, then will return all properties.
	 */
	getSubPropertiesForCompletion(component: LuposComponent, propertyName: 'slotElements', subPropertyNameLabel: string): LuposProperty[] {
		let properties: Map<string, LuposProperty> = new Map()

		for (let com of this.walkComponents(component)) {
			for (let property of Object.values(com[propertyName])) {
				if (property.name.startsWith(subPropertyNameLabel) && !properties.has(property.name)) {
					properties.set(property.name, property)
				}
			}
		}

		return [...properties.values()]
	}

	
	/** Get event of a component. */
	getComponentEvent(component: LuposComponent, eventName: string): LuposEvent | undefined {
		for (let com of this.walkComponents(component)) {
			if (com.events[eventName]) {
				return com.events[eventName]
			}
		}

		return undefined
	}

	/** 
	 * Get events for component, and name starts with label.
	 * `label` can be empty, then will return all events.
	 */
	getComponentEventsForCompletion(component: LuposComponent, label: string): LuposEvent[] {
		let events: Map<string, LuposEvent> = new Map()

		for (let com of this.walkComponents(component)) {
			for (let event of Object.values(com.events)) {
				if (events.has(event.name)) {
					continue
				}

				if (label || event.name.startsWith(label)) {
					events.set(event.name, event)
				}
			}
		}

		return [...events.values()]
	}


	/** Get bindings by name. */
	getBindingsByName(name: string): LuposBinding[] | undefined {
		return this.bindingsByName.get(name)
	}

	/** Get binding by name and template. */
	getBindingByNameAndTemplate(name: string, template: Template): LuposBinding | undefined {
		let bindingClassDeclOrRef = template.getDeclarationOrReferenceByName(name)

		// Local declared.
		let bindingClass = bindingClassDeclOrRef && ts.isClassDeclaration(bindingClassDeclOrRef) ? bindingClassDeclOrRef : undefined

		// Imported.
		if (!bindingClass && bindingClassDeclOrRef) {
			bindingClass = this.context.helper.symbol.resolveDeclaration(bindingClassDeclOrRef, ts.isClassDeclaration)
		}

		// internal bindings like `:class`.
		if (!bindingClass && KnownInternalBindings[name]) {
			bindingClass = this.getBindingsByName(name)?.[0]?.declaration
		}

		if (bindingClass) {
			return this.getBindingByDeclaration(bindingClass)
		}

		return undefined
	}

	/** 
	 * Get binding by it's class declaration, use it for completion.
	 * `declaration` can also be a any level local declaration.
	 */
	getBindingByDeclaration(declaration: TS.ClassDeclaration): LuposBinding | undefined {
		let sourceFile = declaration.getSourceFile()

		// Ensure analyzed source file.
		if (!this.files.has(sourceFile)) {
			this.analyzeTSFile(sourceFile)
		}

		if (declaration.parent !== sourceFile) {
			return createLuposBinding(declaration, this.context.helper)
		}

		let bindings = this.bindingsByFile.get(sourceFile)
		if (bindings) {
			return bindings?.find(c => c.declaration === declaration)
		}

		return undefined
	}	

	/** 
	 * Get bindings that name starts with label.
	 * label` can be empty, then will return all bindings.
	 */
	getBindingsForCompletion(label: string): LuposBinding[] {
		let bindings: LuposBinding[] = []

		for (let binding of this.bindings) {
			if (!label || binding.name.startsWith(label)) {
				bindings.push(binding)
			}
		}

		return bindings
	}


	/** Get a icon from it's defined file name. */
	getIcon(name: string): LuposIcon | null {
		return this.icons.get(name) || null
	}

	/** Get a icon when it's defined file name matches label. */
	getIconsForCompletion(label: string): LuposIcon[] {
		return [...this.icons.values()].filter(icon => icon.name.startsWith(label))
	}
}