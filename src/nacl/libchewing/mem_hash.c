#include "chewing-private.h"
#include "chewing-utf8-util.h"
#include "hash-private.h"
#include "private.h"
#include "memory-private.h"
#include <string.h>

void HashModify( ChewingData *pgdata, HASH_ITEM *pItem ) {
}

int InitHash( ChewingData *pgdata ) {
  pgdata->static_data.chewing_lifetime = 0;
  memset(pgdata->static_data.hashtable, 0,
         sizeof(pgdata->static_data.hashtable));
  return 1;
}
