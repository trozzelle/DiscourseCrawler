import { DuckDBInstance, DuckDBConnection } from '@duckdb/node-api';

interface Forum {
  id?: number;
  url: string;
  categories_crawled: boolean;
}

interface User {
  id?: number;
  forum_id: number;
  json: string;
}

interface Category {
  id?: number;
  category_id: number;
  forum_id: number;
  topic_url: string;
  json: string;
  pages_crawled: boolean;
}

interface Page {
  id?: number;
  page_id: number;
  category_id: number;
  more_topics_url: string | null;
  json: string;
}

interface Topic {
  id?: number;
  topic_id: number;
  category_id: number;
  page_excerpt_json: string;
  topic_json: string;
  posts_crawled: boolean;
}

interface Post {
  id?: number;
  post_id: number;
  topic_id: number;
  json: string;
}

export class Database {

  private db: DuckDBInstance;
  private connection: DuckDBConnection;
  private initialized: boolean = false;

  constructor() {
  }

  async init(databasePath: string = 'discourse.db') {
    const config = {
      path: databasePath,
    };
    //
    this.db = await DuckDBInstance.create(config.path);

    if (!this.initialized) {
      // Create tables if they don't exist
      await this.connection.run(`
          CREATE TABLE IF NOT EXISTS forum
          (
              id
              INTEGER
              PRIMARY
              KEY,
              url
              VARCHAR,
              categories_crawled
              BOOLEAN
              DEFAULT
              FALSE
          );

          CREATE TABLE IF NOT EXISTS user
          (
              id
              INTEGER
              PRIMARY
              KEY,
              forum_id
              INTEGER,
              json
              TEXT,
              FOREIGN
              KEY
          (
              forum_id
          ) REFERENCES forum
          (
              id
          )
              );

          CREATE TABLE IF NOT EXISTS category
          (
              id
              INTEGER
              PRIMARY
              KEY,
              category_id
              INTEGER,
              forum_id
              INTEGER,
              topic_url
              VARCHAR,
              json
              TEXT,
              pages_crawled
              BOOLEAN
              DEFAULT
              FALSE,
              UNIQUE
          (
              category_id,
              forum_id
          ),
              FOREIGN KEY
          (
              forum_id
          ) REFERENCES forum
          (
              id
          )
              );

          CREATE TABLE IF NOT EXISTS page
          (
              id
              INTEGER
              PRIMARY
              KEY,
              page_id
              INTEGER,
              category_id
              INTEGER,
              more_topics_url
              VARCHAR,
              json
              TEXT,
              UNIQUE
          (
              category_id,
              page_id
          ),
              FOREIGN KEY
          (
              category_id
          ) REFERENCES category
          (
              id
          )
              );

          CREATE TABLE IF NOT EXISTS topic
          (
              id
              INTEGER
              PRIMARY
              KEY,
              topic_id
              INTEGER,
              category_id
              INTEGER,
              page_excerpt_json
              TEXT,
              topic_json
              TEXT,
              posts_crawled
              BOOLEAN
              DEFAULT
              FALSE,
              UNIQUE
          (
              category_id,
              topic_id
          ),
              FOREIGN KEY
          (
              category_id
          ) REFERENCES category
          (
              id
          )
              );

          CREATE TABLE IF NOT EXISTS post
          (
              id
              INTEGER
              PRIMARY
              KEY,
              post_id
              INTEGER,
              topic_id
              INTEGER,
              json
              TEXT,
              UNIQUE
          (
              topic_id,
              post_id
          ),
              FOREIGN KEY
          (
              topic_id
          ) REFERENCES topic
          (
              id
          )
              );
      `);

      this.initialized = true;

    }
  }

  async findForum(url: string): Promise<Forum | null> {
    const reader = await this.connection.runAndReadAll(`
        SELECT *
        FROM forum
        WHERE url = ? LIMIT 1
    `, [url]);

    const rows = reader.getRows();
    return rows.length > 0 ? rows[0] as Forum : null;
  }

  async createForum(forum: Forum): Promise<Forum> {
    const reader = await this.connection.runAndReadAll(`
        INSERT INTO forum (url, categories_crawled)
        VALUES (?, ?) RETURNING *
    `, [forum.url, forum.categories_crawled]);

    const rows = reader.getRows();
    return rows[0] as Forum;
  }

  async updateForum(id: number, data: Partial<Forum>): Promise<void> {
    const setStatements: string[] = [];
    const values: any[] = [];

    if (data.url !== undefined) {
      setStatements.push('url = ?');
      values.push(data.url);
    }

    if (data.categories_crawled !== undefined) {
      setStatements.push(`categories_crawled = ?`);
      values.push(data.categories_crawled);
    }

    // If no data, return early
    if (setStatements.length === 0) return;

    values.push(id);

    await this.connection.run(`
        UPDATE forum
        SET ${setStatements.join(', ')}
        WHERE id = ?
    `);
  }

  async findCategoriesByForumId(forumId: number): Promise<Category[]> {
    const reader = await this.connection.runAndReadAll(`
        SELECT *
        FROM category
        WHERE forum_id = ?
    `, [forumId]);

    return reader.getRows() as Category[];
  }

  async findCategoryByCategoryIdAndForumId(categoryId: number, forumId: number): Promise<Category | null> {
    const reader = await this.connection.runAndReadAll(`
        SELECT *
        FROM category
        WHERE category_id = ?
          AND forum_id = ? LIMIT 1
    `, [categoryId, forumId]);

    const rows = reader.getRows();
    return rows.length > 0 ? rows[0] as Category : null;
  }

  async createCategory(category: Category): Promise<Category> {
    const existing = await this.findCategoryByCategoryIdAndForumId(
      category.category_id,
      category.forum_id,
    );

    if (existing) return existing;

    const reader = await this.connection.runAndReadAll(`
        INSERT INTO category (category_id, forum_id, topic_url, json, pages_crawled)
        VALUES (?, ?, ?, ?, ?) RETURNING *
    `, [
      category.category_id,
      category.forum_id,
      category.topic_url,
      category.json,
      category.pages_crawled,
    ]);

    const rows = reader.getRows();

    return rows[0] as Category;
  }

  async updateCategory(id: number, data: Partial<Category>): Promise<void> {
    const setStatements: string[] = [];
    const values: any[] = [];

    if (data.topic_url !== undefined) {
      setStatements.push('topic_url = ?');
      values.push(data.topic_url);
    }

    if (data.json !== undefined) {
      setStatements.push('json = ?');
      values.push(data.json);
    }

    if (data.pages_crawled !== undefined) {
      setStatements.push(`pages_crawled = ?`);
      values.push(data.pages_crawled);
    }

    // If no data, return early
    if (setStatements.length === 0) return;

    values.push(id);

    await this.connection.run(`
        UPDATE forum
        SET ${setStatements.join(', ')}
        WHERE id = ?
    `);
  }


  async findTopicByCategoryIdAndTopicId(categoryId: number, topicId: number): Promise<Topic | null> {
    const reader = await this.connection.runAndReadAll(`
        SELECT *
        FROM topic
        WHERE category_id = ?
          AND forum_id = ? LIMIT 1
    `, [categoryId, topicId]);

    const rows = reader.getRows();
    return rows.length > 0 ? rows[0] as Category : null;
  }

  async getTopicsByCategoryId(categoryId: number): Promise<Topic[]> {
    const reader = await this.connection.runAndReadAll(`
        SELECT *
        FROM topic
        where category_id = ?
        ORDER BY topic_id desc
    `, [categoryId]);

    return reader.getRows() as Topic[];
  }

  async createTopic(topic: Topic): Promise<Topic> {
    const existing = await this.findTopicByCategoryIdAndTopicId(
      topic.category_id,
      topic.category_id,
    );

    if (existing) return existing;

    const reader = await this.connection.runAndReadAll(`
        INSERT INTO topic (topic_id, category_id, page_excerpt_json, topic_json, posts_crawled)
        VALUES (?, ?, ?, ?, ?) RETURNING *
    `, [
      topic.topic_id,
      topic.category_id,
      topic.page_excerpt_json,
      topic.topic_json,
      topic.posts_crawled,
    ]);

    const rows = reader.getRows();

    return rows[0] as Topic;
  }

  async updateTopic(id: number, data: Partial<Topic>): Promise<void> {
    const setStatements: string[] = [];
    const values: any[] = [];

    if (data.page_excerpt_json !== undefined) {
      setStatements.push('page_excerpt_json = ?');
      values.push(data.page_excerpt_json);
    }

    if (data.topic_json !== undefined) {
      setStatements.push('topic_json = ?');
      values.push(data.topic_json);
    }

    if (data.posts_crawled !== undefined) {
      setStatements.push(`posts_crawled = ?`);
      values.push(data.posts_crawled);
    }

    // If no data, return early
    if (setStatements.length === 0) return;

    values.push(id);

    await this.connection.run(`
        UPDATE forum
        SET ${setStatements.join(', ')}
        WHERE id = ?
    `);
  }

  async findPostByPostIdAndTopicId(postId: number, topicId: number): Promise<Post | null> {
    const reader = await this.connection.runAndReadAll(`
        SELECT *
        FROM post
        WHERE post_id = ?
          AND topic_id = ? LIMIT 1
    `, [postId, topicId]);

    const rows = reader.getRows();
    return rows.length > 0 ? rows[0] as Post : null;
  }

  async createPost(post: Post): Promise<Post> {
    const existing = await this.findPostByPostIdAndTopicId(
      post.post_id,
      post.topic_id,
    );

    if (existing) return existing;

    const reader = await this.connection.runAndReadAll(`
        INSERT INTO post (post_id, topic_id, json)
        VALUES (?, ?, ?) RETURNING *
    `, [
      post.post_id,
      post.topic_id,
      post.json,
    ]);

    const rows = reader.getRows();

    return rows[0] as Post;
  }

  async findPageByCategoryIdAndPageId(categoryId: number, pageId: number): Promise<Page | null> {
    const reader = await this.connection.runAndReadAll(`
        SELECT *
        FROM page
        WHERE category_id = ?
          AND page_id = ? LIMIT 1
    `, [categoryId, pageId]);

    const rows = reader.getRows();

    return rows.length > 0 ? rows[0] as Page : null;
  }

  async createPage(page: Page): Promise<Page> {
    const existing = await this.findPageByCategoryIdAndPageId(
      page.category_id,
      page.page_id,
    );

    if (existing) return existing;

    const reader = await
  .
    connection.runAndReadAll(`
        INSERT INTO page (page_id, category_id, more_topics_url, json)
        VALUES (?, ?, ?, ?) RETURNING *
    `, [page.page_id, page.category_id, page.more_topics_url, page.json]);

    const rows = reader.getRows();
    return rows[0] as Page;
  }

  async getLastPageByCategory(categoryId: number): Promise<Page | null> {
    const reader = await this.connection.runAndReadAll(`
        SELECT *
        FROM page
        WHERE category_id = ?
        ORDER BY page_id desc LIMIT 1
    `, [categoryId]);

    const rows = reader.getRows();
    return rows.length > 0 ? rows[0] as Page : null;
  }

  async bulkInsertPosts(posts: Post[]): Promise<void> {
    if (posts.length === 0) return;

    const appender = await this.connection.createAppender('main', 'post');

    for (const post of posts) {
      appender.appendInteger(post.post_id);
      appender.appendInteger(post.topic_id);
      appender.appendVarchar(post.json);
      appender.endRow();
    }

    appender.close();
  }

  async query<T>(sql: string, params: any[] = []): Promise<T[]> {
    const reader = await this.connection.runAndReadAll(sql, params);
    return reader.getRows() as T[];
  }

  async close(): Promise<void> {
    if (this.connection) await this.connection.close();

  }


}

export async function createDatabase(dbPath: string = 'discourse.db'): Promise<Database> {
  const db = new Database();
  await db.init(dbPath);
  return db;
}