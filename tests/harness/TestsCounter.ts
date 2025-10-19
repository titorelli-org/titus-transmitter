import { afterEach, beforeEach } from "node:test";

export class TestsCounter {
  private count: number = 0;
  private readonly callback: () => void;

  constructor(callback: () => void) {
    this.callback = callback;
  }

  incr() {
    console.log("incr!!!", this.count + 1);

    this.count++;
  }

  decr() {
    console.log("decr!!!", this.count);

    if (this.count > 0) {
      this.count--;
    }

    if (this.count <= 0) {
      this.callback();
    }
  }

  setup() {
    beforeEach(() => this.incr());

    afterEach(() => this.decr());
  }
}
