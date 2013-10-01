#ifndef CONFIG_H
#define CONFIG_H

#define UNDER_POSIX
#define HAVE_STRTOK_R
#define LIBDIR "/data"

// For chewingutil.c
#include <stdio.h>

// For hash.c
#ifdef OVERRIDE_HASH
#define HashModify  BrokenHashModify
#define InitHash    BrokenInitHash
#endif

#endif /* CONFIG_H */
