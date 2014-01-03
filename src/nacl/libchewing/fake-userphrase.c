/**
 * userphrase.c
 *
 * Copyright (c) 1999, 2000, 2001
 *	Lu-chuan Kung and Kang-pen Chen.
 *	All rights reserved.
 *
 * Copyright (c) 2004, 2006
 *	libchewing Core Team. See ChangeLog for details.
 *
 * See the file "COPYING" for information on usage and redistribution
 * of this file.
 */

#include <assert.h>
#include <stdlib.h>
#include <string.h>
#include <stdio.h>

#include "chewing-utf8-util.h"
#include "dict-private.h"
#include "tree-private.h"
#include "userphrase-private.h"
#include "private.h"
#include "key2pho-private.h"

void UserUpdatePhraseBegin( ChewingData *pgdata )
{
}

int UserUpdatePhrase(ChewingData *pgdata, const uint16_t phoneSeq[], const char wordSeq[])
{
}

void UserUpdatePhraseEnd( ChewingData *pgdata )
{
}

void UserRemovePhrase(ChewingData *pgdata, const uint16_t phoneSeq[], const char wordSeq[])
{
}


UserPhraseData *UserGetPhraseFirst(ChewingData *pgdata, const uint16_t phoneSeq[])
{
  return NULL;
}

UserPhraseData *UserGetPhraseNext(ChewingData *pgdata, const uint16_t phoneSeq[])
{
  return NULL;
}

void UserGetPhraseEnd(ChewingData *pgdata, const uint16_t phoneSeq[])
{
}

void IncreaseLifeTime( ChewingData *pgdata )
{
}
