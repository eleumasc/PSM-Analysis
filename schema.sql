CREATE TABLE IF NOT EXISTS domain_lists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_filename TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS domains (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  domain_list INTEGER NOT NULL,
  rank INTEGER NOT NULL,
  domain TEXT NOT NULL,

  FOREIGN KEY (domain_list) REFERENCES domain_lists (id)
);

CREATE TABLE IF NOT EXISTS signup_page_searches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  domain_list INTEGER NOT NULL,

  FOREIGN KEY (domain_list) REFERENCES domain_lists (id)
);

CREATE TABLE IF NOT EXISTS signup_page_search_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  signup_page_search INTEGER NOT NULL,
  domain INTEGER NOT NULL,
  detail TEXT NOT NULL,

  UNIQUE (signup_page_search, domain),
  FOREIGN KEY (signup_page_search) REFERENCES signup_page_searches (id),
  FOREIGN KEY (domain) REFERENCES domains (id)
);
