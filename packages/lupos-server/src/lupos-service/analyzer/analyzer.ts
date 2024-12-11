import type * as TS from 'typescript'
import {analyzeLuposIcons, LuposIcon} from './icons'
import {Logger, ProjectContext} from '../../core'
import {LuposBinding, LuposComponent, LuposEvent, LuposProperty} from './types'
import {Analyzer} from '../../lupos-ts-module'


export class WorkSpaceAnalyzer extends Analyzer {

	readonly context: ProjectContext

	/** All imported icons. */
	private icons: Map<string, LuposIcon> = new Map()

	constructor(context: ProjectContext) {
		super(context.helper)
		this.context = context
	}

	/** Analyze each ts source file. */
	protected analyzeTSFile(sourceFile: TS.SourceFile) {
		super.analyzeTSFile(sourceFile)

		let icons = analyzeLuposIcons(sourceFile, this.context.helper)

		for (let icon of icons) {
			this.icons.set(icon.name, icon)
		}
	}

	/** Update to make sure reloading changed source files. */
	update() {
		let changedFiles = this.compareFiles()

		for (let file of changedFiles) {
			this.analyzeTSFile(file)
		}

		if (changedFiles.size > 0) {
			Logger.log(`Analyzed ${changedFiles.size} files`)
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

		for (let file of expiredFiles) {
			this.makeFileExpire(file)
		}

		this.files = allFiles

		return changedFiles
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