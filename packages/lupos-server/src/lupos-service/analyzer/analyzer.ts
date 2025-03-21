import type * as TS from 'typescript'
import {analyzeLuposIcons, LuposIcon} from './icons'
import {Logger, ProjectContext} from '../../core'
import {Analyzer, LuposBinding, LuposComponent, LuposEvent, LuposProperty} from '../../lupos-ts-module'
import {makeStartsMatchExp} from '../utils'


export class WorkSpaceAnalyzer extends Analyzer {

	readonly context: ProjectContext

	/** All imported icons. */
	private icons: Map<string, LuposIcon> = new Map()

	constructor(context: ProjectContext) {
		super(context.helper)
		this.context = context
	}

	/** Analyze each ts source file. */
	protected analyzeFile(sourceFile: TS.SourceFile) {
		super.analyzeFile(sourceFile)

		let icons = analyzeLuposIcons(sourceFile, this.context.helper)

		for (let icon of icons) {
			this.icons.set(icon.name, icon)
		}
	}

	/** 
	 * Update to make sure reloading changed source files.
	 * Update for at most once within a micro task.
	 */
	update() {
		let changedFiles = this.compareFiles()

		for (let file of changedFiles) {
			this.analyzeFile(file)
		}

		if (changedFiles.size > 0) {
			Logger.log(`Analyzed ${changedFiles.size} files, now have ${[...this.components].length} components, ${[...this.bindings].length} bindings.`)
		}
	}

	/** Compare files, returned changed or not analyzed files, always exclude `lib.???.d.ts`. */
	private compareFiles() {

		// Exclude typescript lib files.
		let allFiles = new Set(
			this.context.program.getSourceFiles()
				.filter(file => !this.context.helper.symbol.isOfTypescriptLib(file))
		)

		// Not analyzed, or changed, or has referenced changed.
		let changedFiles: Set<TS.SourceFile> = new Set()

		// Delete files.
		for (let file of [...this.files.keys()]) {
			if (!allFiles.has(file)) {
				this.deleteFile(file)
				this.files.delete(file)
			}
		}

		for (let file of allFiles) {

			// Changed file will build a new source file.
			if (this.files.has(file)) {
				continue
			}

			changedFiles.add(file)

			// Also mark all files reference it as changed.
			let refFromFilePaths = this.references.getByRight(file.fileName)
			if (refFromFilePaths) {
				for (let refFromFile of refFromFilePaths) {
					changedFiles.add(refFromFile)
				}
			}
		}

		return changedFiles
	}

	/** 
	 * Get components that name starts with label.
	 * label` can be empty, then will return all components.
	 */
	getComponentsForCompletion(label: string): LuposComponent[] {
		let components: LuposComponent[] = []
		let re = makeStartsMatchExp(label)

		for (let component of this.components) {
			if (re.test(component.name)) {
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
		let re = makeStartsMatchExp(label)

		for (let com of this.walkComponents(component)) {
			for (let property of Object.values(com.properties)) {
				if (mustBePublic && !property.public) {
					continue
				}

				if (properties.has(property.name)) {
					continue
				}
				
				if (re.test(property.name)) {
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
		let re = makeStartsMatchExp(subPropertyNameLabel)

		for (let com of this.walkComponents(component)) {
			for (let property of Object.values(com[propertyName])) {
				if (re.test(property.name) && !properties.has(property.name)) {
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
		let re = makeStartsMatchExp(label)

		for (let com of this.walkComponents(component)) {
			for (let event of Object.values(com.events)) {
				if (events.has(event.name)) {
					continue
				}

				if (re.test(event.name)) {
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
		let re = makeStartsMatchExp(label)

		for (let binding of this.bindings) {
			if (re.test(binding.name)) {
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
		let re = makeStartsMatchExp(label)
		return [...this.icons.values()].filter(icon => re.test(icon.name))
	}
}