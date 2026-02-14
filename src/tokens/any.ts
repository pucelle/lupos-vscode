enum ScanState {
	EOF = 0,
	AnyContent = 1,
}


export class AnyTokenScanner {

	readonly string: string
	readonly scannerStart: number

	protected start = 0
	protected offset = 0
	protected state: number = ScanState.AnyContent
	protected endState: number = ScanState.EOF

	/** For complex state management when you don't want building a tree. */
	protected stateStack: number[] = []

	constructor(string: string, scannerStart: number = 0) {
		this.string = string
		this.scannerStart = scannerStart
	}

	/** For complex state management when you don't want building a tree. */
	protected enterState(state: number) {
		this.stateStack.push(this.state)
		this.state = state
	}

	/** For complex state management when you don't want building a tree. */
	protected exitState() {
		if (this.stateStack.length === 0) {
			this.state = ScanState.EOF
		}
		else {
			this.state = this.stateStack.pop()!
		}
	}

	protected isEnded(): boolean {
		return this.state === ScanState.EOF
	}

	protected peekChars(move: number = 0, count: number): string {
		return this.string.slice(this.offset + move, this.offset + move + count)
	}

	protected peekChar(move: number = 0): string {
		return this.string.substring(this.offset + move, this.offset + move + 1)
	}

	/** Peek text within `start` and `offset`. */
	protected peekText() {
		return this.string.slice(this.start, this.offset)
	}

	/** 
	 * It moves `offset` to before match.
	 * Note the `re` must have `g` flag set.
	 */
	protected readUntilToMatch(re: RegExp): RegExpExecArray | null {
		re.lastIndex = this.offset
		let m = re.exec(this.string)

		if (m) {
			this.offset = m.index
		}
		else {
			this.offset = this.string.length
			this.endState = this.state
			this.state = ScanState.EOF
		}

		return m
	}

	/** 
	 * It moves `offset` to after match.
	 * Note the `re` must have `g` flag set.
	 */
	protected readOutToMatch(re: RegExp): RegExpExecArray | null {
		re.lastIndex = this.offset
		let m = re.exec(this.string)

		if (m) {
			this.offset = m.index + m[0].length
		}
		else {
			this.offset = this.string.length
			this.endState = this.state
			this.state = ScanState.EOF
		}

		return m
	}

	/** Read all whitespaces, move cursor to before first non white space. */
	protected readWhiteSpaces(): boolean {
		return !!this.readUntilToMatch(/\S/g)
	}

	/** Read chars until before `|\r\n`. */
	protected readLine(): boolean {
		if (!this.readUntilToMatch(/[\r\n]/g)) {
			return false
		}

		// Move cursor to `\r|\n`.
		if (this.peekChar() === '\r' && this.peekChar(1) === '\n') {
			this.offset += 1
		}

		return true
	}

	/** Read chars until after `\r\n`. */
	protected readLineAndEnd(): boolean {
		if (!this.readLine()) {
			return false
		}

		this.offset += 1

		return true
	}

	/** 
	 * Back search from `offset` to preceding.
	 * Can only search one character each time.
	 */
	protected backSearchChar(from: number, match: RegExp, maxCount: number = Infinity): number {
		let until = Math.max(from - maxCount, 0)

		for (let i = from; i >= until; i--) {
			let char = this.string[i]
			if (match.test(char)) {
				return i
			}
		}

		return -1
	}

	/** Moves start to current offset and skip all chars between. */
	protected sync() {
		this.start = this.offset
	}
}
