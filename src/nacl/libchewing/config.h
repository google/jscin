#ifndef CONFIG_H
#define CONFIG_H

#define UNDER_POSIX
#define HAVE_STRTOK_R
#define LIBDIR "/data"

// Hacks for sqlite3.
#define SQLITE_OMIT_LOAD_EXTENSION
#if !defined __GLIBC__
#include <stdio.h>
struct flock {
       short   l_type;
       short   l_whence;
       off_t   l_start;
       off_t   l_len;
       pid_t   l_pid;
};
#endif

#endif /* CONFIG_H */
