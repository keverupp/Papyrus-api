"use strict";

class PagePool {
  constructor(createPageFn, maxPages = 5, app = null) {
    this.createPageFn = createPageFn;
    this.maxPages = maxPages;
    this.app = app;
    this.idlePages = [];
    this.pending = [];
    this.totalPages = 0;
  }

  async acquire() {
    if (this.idlePages.length > 0) {
      return this.idlePages.pop();
    }
    if (this.totalPages < this.maxPages) {
      const page = await this.createPageFn();
      this.totalPages++;
      return page;
    }
    return new Promise((resolve) => {
      this.pending.push(resolve);
    });
  }

  async release(page) {
    try {
      await page.goto("about:blank");
      page.removeAllListeners("request");
    } catch (err) {
      this.app?.log?.warn("⚠️ Erro ao limpar página do pool:", err);
    }

    if (this.pending.length > 0) {
      const resolve = this.pending.shift();
      resolve(page);
    } else {
      this.idlePages.push(page);
    }
  }

  async destroy() {
    while (this.idlePages.length > 0) {
      const page = this.idlePages.pop();
      try {
        await page.close();
      } catch (err) {
        this.app?.log?.warn("⚠️ Erro ao fechar página do pool:", err);
      } finally {
        this.totalPages--;
      }
    }
  }
}

module.exports = PagePool;

