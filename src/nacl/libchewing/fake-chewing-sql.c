/**
 * chewing-sql.c
 *
 * Copyright (c) 2013
 *	libchewing Core Team. See ChangeLog for details.
 *
 * See the file "COPYING" for information on usage and redistribution
 * of this file.
 */

#include "chewing-sql.h"
#include "chewing-private.h"

#include <assert.h>
#include <stdlib.h>
#include <stdio.h>

#include "memory-private.h"
#include "plat_types.h"
#include "private.h"
#include "sqlite3.h"
#include "userphrase-private.h"

const SqlStmtUserphrase SQL_STMT_USERPHRASE[STMT_USERPHRASE_COUNT] = {
	{
		"SELECT length, phrase, "
			"phone_0, phone_1, phone_2, phone_3, phone_4, phone_5, "
			"phone_6, phone_7, phone_8, phone_9, phone_10 "
			"FROM userphrase_v1",
		{ -1, -1, -1, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12 },
	},
	{
		"SELECT time, orig_freq, max_freq, user_freq, phrase "
			"FROM userphrase_v1 WHERE length = ?5 AND "
			"phone_0 = ?10 AND phone_1 = ?11 AND phone_2 = ?12 AND "
			"phone_3 = ?13 AND phone_4 = ?14 AND phone_5 = ?15 AND "
			"phone_6 = ?16 AND phone_7 = ?17 AND phone_8 = ?18 AND "
			"phone_9 = ?19 AND phone_10 = ?20",
		{ 0, 1, 2, 3, -1, 4, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1 },
	},
	{
		"SELECT time, orig_freq, max_freq, user_freq "
			"FROM userphrase_v1 WHERE length = ?5 AND phrase = ?6 AND "
			"phone_0 = ?10 AND phone_1 = ?11 AND phone_2 = ?12 AND "
			"phone_3 = ?13 AND phone_4 = ?14 AND phone_5 = ?15 AND "
			"phone_6 = ?16 AND phone_7 = ?17 AND phone_8 = ?18 AND "
			"phone_9 = ?19 AND phone_10 = ?20",
		{ 0, 1, 2, 3, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1 },
	},
	{
		"INSERT OR REPLACE INTO userphrase_v1 ("
			"time, orig_freq, max_freq, user_freq, length, phrase, "
			"phone_0, phone_1, phone_2, phone_3, phone_4, phone_5, "
			"phone_6, phone_7, phone_8, phone_9, phone_10) "
			"VALUES (?1, ?2, ?3, ?4, ?5, ?6, "
			"?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20)",
		{ -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1 },
	},
	{
		"DELETE FROM userphrase_v1 WHERE length = ?5 AND phrase = ?6 AND "
			"phone_0 = ?10 AND phone_1 = ?11 AND phone_2 = ?12 AND "
			"phone_3 = ?13 AND phone_4 = ?14 AND phone_5 = ?15 AND "
			"phone_6 = ?16 AND phone_7 = ?17 AND phone_8 = ?18 AND "
			"phone_9 = ?19 AND phone_10 = ?20",
		{ -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1 },
	},
	{
		"SELECT MAX(user_freq) FROM userphrase_v1 WHERE length = ?5 AND "
			"phone_0 = ?10 AND phone_1 = ?11 AND phone_2 = ?12 AND "
			"phone_3 = ?13 AND phone_4 = ?14 AND phone_5 = ?15 AND "
			"phone_6 = ?16 AND phone_7 = ?17 AND phone_8 = ?18 AND "
			"phone_9 = ?19 AND phone_10 = ?20",
		{ -1, -1, -1, 0, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1 },
	},
};

const SqlStmtConfig SQL_STMT_CONFIG[STMT_CONFIG_COUNT] = {
	{
		"SELECT value FROM config_v1 WHERE id = ?1",
		{ -1, 0 },
	},
	{
		"INSERT OR IGNORE INTO config_v1 (id, value) VALUES (?1, ?2)",
		{ -1, -1 },
	},
	{
		"UPDATE config_v1 SET value = value + ?2 WHERE id = ?1",
		{ -1, -1 },
	},
};


int InitSql(ChewingData *pgdata, const char *path)
{
  return 0;
}

void TerminateSql(ChewingData *pgdata)
{
}

char *GetDefaultUserPhrasePath(ChewingData *pgdata)
{
  return "/home";
}

SQLITE_API int sqlite3_reset(sqlite3_stmt *pStmt) {
  return SQLITE_OK;
}

SQLITE_API int sqlite3_step(sqlite3_stmt *pStmt) {
  return SQLITE_OK;
}

SQLITE_API const unsigned char *sqlite3_column_text(sqlite3_stmt *pStmt, int i)
{
  return SQLITE_OK;
}

SQLITE_API int sqlite3_column_int(sqlite3_stmt *pStmt, int i) {
  return SQLITE_OK;
}
