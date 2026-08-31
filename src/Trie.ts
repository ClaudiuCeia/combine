/**
 * A node in a trie used for fast multi-string matching.
 *
 * This is an internal building block for the `trie(...)` parser.
 */
export class TrieNode {
  public children: { [id: string]: TrieNode } = {};
  public isWord: boolean;

  constructor(public readonly content: string = "") {
    this.isWord = false;
  }
}

/**
 * Trie (prefix tree) used to match one of many strings efficiently.
 */
export class Trie {
  constructor(private readonly root = new TrieNode()) {}

  /**
   * Insert a word into the trie.
   */
  public insert(word: string): void {
    let current = this.root;
    for (let i = 0; i < word.length; i++) {
      const letter = word.charAt(i);
      if (!current.children[letter]) {
        current.children[letter] = new TrieNode(letter);
      }
      current = current.children[letter];
    }

    current.isWord = true;
  }

  /**
   * Insert many words into the trie.
   */
  public insertMany(words: string[]): void {
    for (const word of words) {
      this.insert(word);
    }
  }

  /**
   * Check whether the trie contains `word` exactly.
   */
  public exists(word: string): boolean {
    let current = this.root;
    for (let i = 0; i < word.length; i++) {
      const ch = word.charAt(i);
      const node = current.children[ch];
      if (!node) {
        return false;
      }
      current = node;
    }

    return current.isWord;
  }

  /**
   * Check whether any prefix of `word` exists in the trie, returning the
   * longest matching prefix if present.
   */
  public existsSubstring(word: string): [boolean, string | undefined] {
    const { match } = this.matchPrefix(word);
    return match === undefined ? [false, undefined] : [true, match];
  }

  /**
   * Find the longest complete word and whether all supplied input is still a
   * prefix of a longer word.
   */
  public matchPrefix(word: string): {
    match: string | undefined;
    canExtend: boolean;
  } {
    let current = this.root;
    let match = this.root.isWord ? "" : undefined;

    for (let i = 0; i < word.length; i++) {
      const ch = word.charAt(i);
      const node = current.children[ch];
      if (!node) {
        return { match, canExtend: false };
      }

      if (node.isWord) {
        match = word.substring(0, i + 1);
      }

      current = node;
    }

    return {
      match,
      canExtend: Object.keys(current.children).length > 0,
    };
  }
}
