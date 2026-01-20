export class TrieNode {
  public children: { [id: string]: TrieNode } = {};
  public isWord: boolean;

  constructor(public readonly content: string = "") {
    this.isWord = false;
  }
}

export class Trie {
  constructor(private readonly root = new TrieNode()) {}

  public insert(word: string): void {
    let current = this.root;
    for (const letter of word) {
      if (!current.children[letter]) {
        current.children[letter] = new TrieNode(letter);
      }
      current = current.children[letter];
    }

    current.isWord = true;
  }

  public insertMany(words: string[]): void {
    for (const word of words) {
      this.insert(word);
    }
  }

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

  public existsSubstring(word: string): [boolean, string | undefined] {
    let current = this.root;
    for (let i = 0; i < word.length; i++) {
      const ch = word.charAt(i);
      const node = current.children[ch];
      if (!node) {
        return [false, undefined];
      }

      if (node.isWord) {
        return [true, word.substring(0, i + 1)];
      }

      current = node;
    }

    return [current.isWord, word];
  }
}
