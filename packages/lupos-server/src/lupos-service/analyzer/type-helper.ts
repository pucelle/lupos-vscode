export namespace TypeHelper {

	/** Format type to a readable description. */
	export function getTypeDescription(type: ts.Type) {
		return this.typeChecker.typeToString(type)
	}

	/** Format type to a readable description. */
	export function getTypeUnionStringList(type: ts.Type): string[] {
		if (type.isUnion()) {
			return type.types.map(t => this.getTypeUnionStringList(t)).flat()
		}
		else if (type.isStringLiteral()) {
			return [this.getTypeDescription(type).replace(/['"]/g, '')]
		}
		else {
			return []
		}
	}
}
