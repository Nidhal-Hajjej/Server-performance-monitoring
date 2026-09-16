#!/bin/sh

# Total CPU usage 
echo "CPU Usage:"
mpstat | grep "all" | awk '{printf "  User: %.2f%%  System: %.2f%%  Idle: %.2f%%\n", 100-$12, $5, $12}'
echo ""

# Total memory usage (Free vs Used including percentage)
echo "Memory Usage:"
free -h | awk 'NR==2{printf "  Total: %s  Used: %s  Free: %s  Usage: %.2f%%\n", $2, $3, $4, ($3/$2)*100}'
echo ""

# Total disk usage (Free vs Used including percentage)
echo "Disk Usage:"
df -h | grep '^/dev/' | awk '{printf "  %s  Total: %s  Used: %s  Available: %s  Usage: %s\n", $1, $2, $3, $4, $5}'
echo ""

# Top 5 processes by CPU usage
echo "Top 5 Processes by CPU Usage:"
ps -eo pid,comm,%cpu --sort=-%cpu | head -n 6
echo ""

# Top 5 processes by memory usage
echo "Top 5 Processes by Memory Usage:"
ps -eo pid,comm,%mem --sort=-%mem | head -n 6
echo ""

# OS Version
echo "OS Version:"
lsb_release -a
echo ""