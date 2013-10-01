#ifndef CONFIG_H
#define CONFIG_H

// For chewingutil.c
#include <stdio.h>

// For hash.c
#ifdef OVERRIDE_HASH
#define HashModify  BrokenHashModify
#define InitHash    BrokenInitHash
#endif

#endif /* CONFIG_H */
