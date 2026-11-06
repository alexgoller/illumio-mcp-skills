# Listening process and port to role

`scripts/advise.py` parses this table at run time; it is the only copy. A row names a
listener the VEN reports in `services.open_service_ports` (process basename, port,
protocol) and the role it implies. Matching: the process cell is a case-insensitive
basename match (`mysqld`, `sqlservr.exe`; the PCE may report the full path), the port
cell is one port, a comma-separated list or `*`, proto is `tcp`, `udp` or `*`, os is
`linux`, `windows` or `*`. A row whose process is `*` is a port-only row, the weakest
evidence; the script uses it when the process is unknown or unreported, for ports a
workload serves in the traffic, and for hubs. A port-only row whose note starts with
`hub only` is used for hubs alone (many sources on that port), because every Windows
host serves 445 and any HTTPS listener matches 443.

How matches combine: a process row beats a port-only row on the same port; a specific
port beats `*`; an os-specific row that matches the VEN's os adds the `ven_os` signal
(Windows plus `lsass.exe` on 389 is a domain controller). A role of `-` means a known
listener that is not a role on its own: `sshd` on 22, RDP on 3389, monitoring, backup
and security agents run on every host and never produce a role. When two rows on one
host disagree (Jenkins on 8080 and Redis on 6379), the script does not choose, except
that DNS, DHCP, NTP and File yield to Directory, because a domain controller serves all
of them. Role values are canonical nouns; the script maps them to the customer's
existing role vocabulary by case-insensitive match or alias (`db` for Database) before
proposing a new value. The model pass may extend this table from `unresolved.md`, one
row per binary it can justify, and the owner keeps or drops the row.

| process | port | proto | os | role | note |
| --- | --- | --- | --- | --- | --- |
| nginx | 80,443,8080,8443 | tcp | * | Web | reverse proxy or static web |
| httpd | 80,443,8080,8443 | tcp | linux | Web | Apache on RHEL family |
| apache2 | 80,443,8080,8443 | tcp | linux | Web | Apache on Debian family |
| w3wp.exe | 80,443 | tcp | windows | Web | IIS worker process |
| lighttpd | 80,443 | tcp | linux | Web | |
| caddy | 80,443 | tcp | * | Web | |
| haproxy | 80,443 | tcp | linux | Web | load balancer; use a LB role if the customer has one |
| traefik | 80,443 | tcp | * | Web | ingress or edge proxy |
| java | 8080,8443,8009 | tcp | * | App | Tomcat, Spring Boot, JBoss, Jetty |
| java | 7001,7002 | tcp | * | App | WebLogic |
| java | 9080,9443 | tcp | * | App | WebSphere |
| node | 3000,8080,8000 | tcp | * | App | Node.js service |
| gunicorn | 8000 | tcp | linux | App | Python WSGI |
| uwsgi | 8000,3031 | tcp | linux | App | Python WSGI |
| php-fpm | 9000 | tcp | linux | App | PHP backend behind a web tier |
| dotnet | 5000,5001 | tcp | * | App | ASP.NET Core (Kestrel) |
| puma | 3000 | tcp | linux | App | Ruby |
| unicorn | 8080 | tcp | linux | App | Ruby |
| mysqld | 3306 | tcp | * | Database | MySQL |
| mariadbd | 3306 | tcp | linux | Database | MariaDB |
| postgres | 5432 | tcp | * | Database | PostgreSQL |
| tnslsnr | 1521 | tcp | * | Database | Oracle listener |
| oracle | 1521 | tcp | * | Database | Oracle |
| sqlservr.exe | 1433 | tcp | windows | Database | SQL Server |
| mongod | 27017 | tcp | * | Database | MongoDB |
| db2sysc | 50000 | tcp | * | Database | Db2 |
| cockroach | 26257 | tcp | * | Database | CockroachDB |
| java | 9042,7000 | tcp | * | Database | Cassandra |
| java | 9200,9300 | tcp | * | Database | Elasticsearch or OpenSearch (the binary is java) |
| elasticsearch | 9200,9300 | tcp | * | Database | Elasticsearch |
| redis-server | 6379 | tcp | * | Cache | Redis |
| memcached | 11211 | tcp | * | Cache | |
| varnishd | 80,6081 | tcp | linux | Cache | HTTP cache |
| beam.smp | 5672,15672,25672 | tcp | * | Queue | RabbitMQ (Erlang VM) |
| java | 9092 | tcp | * | Queue | Kafka broker |
| java | 61616,8161 | tcp | * | Queue | ActiveMQ |
| activemq | 61616 | tcp | * | Queue | ActiveMQ |
| mosquitto | 1883,8883 | tcp | * | Queue | MQTT |
| nats-server | 4222 | tcp | * | Queue | NATS |
| lsass.exe | 88,389,636,3268,3269 | tcp | windows | Directory | domain controller (Kerberos, LDAP, global catalog) |
| lsass.exe | 88,389 | udp | windows | Directory | domain controller |
| slapd | 389,636 | tcp | linux | Directory | OpenLDAP |
| ns-slapd | 389,636 | tcp | linux | Directory | 389 Directory Server, FreeIPA |
| krb5kdc | 88 | * | linux | Directory | MIT Kerberos KDC |
| named | 53 | * | linux | DNS | BIND |
| dns.exe | 53 | * | windows | DNS | Windows DNS server (on a DC it yields to Directory) |
| unbound | 53 | * | linux | DNS | |
| dnsmasq | 53 | * | linux | DNS | |
| coredns | 53 | * | * | DNS | |
| systemd-resolved | 53 | * | linux | - | local stub resolver on 127.0.0.53, not a DNS server |
| dhcpd | 67 | udp | linux | DHCP | ISC DHCP |
| kea-dhcp4 | 67 | udp | linux | DHCP | Kea |
| svchost.exe | 67 | udp | windows | DHCP | Windows DHCP Server service |
| ntpd | 123 | udp | linux | NTP | |
| chronyd | 123 | udp | linux | NTP | |
| smbd | 445,139 | tcp | linux | File | Samba |
| nfsd | 2049 | * | linux | File | NFS |
| rpc.mountd | 20048 | * | linux | File | NFS |
| vsftpd | 21 | tcp | linux | File | FTP |
| proftpd | 21 | tcp | linux | File | FTP |
| System | 445,139 | tcp | windows | - | SMB served by the kernel on every Windows host; a file server is a hub on 445 |
| master | 25,587,465 | tcp | linux | Mail | Postfix |
| smtpd | 25 | tcp | linux | Mail | Postfix or OpenSMTPD |
| exim | 25,587 | tcp | linux | Mail | |
| exim4 | 25,587 | tcp | linux | Mail | |
| sendmail | 25,587 | tcp | linux | Mail | |
| dovecot | 143,993,110,995 | tcp | linux | Mail | IMAP and POP |
| MSExchangeTransport.exe | 25,2525 | tcp | windows | Mail | Exchange transport |
| MSExchangeFrontendTransport.exe | 25,587 | tcp | windows | Mail | Exchange front end |
| zabbix_server | 10051 | tcp | linux | Monitoring | Zabbix server |
| zabbix_proxy | 10051 | tcp | linux | Monitoring | Zabbix proxy |
| zabbix_agentd | 10050 | tcp | * | - | agent on every monitored host |
| zabbix_agent2 | 10050 | tcp | * | - | agent on every monitored host |
| prometheus | 9090 | tcp | * | Monitoring | |
| alertmanager | 9093 | tcp | * | Monitoring | |
| node_exporter | 9100 | tcp | linux | - | exporter on every monitored host |
| windows_exporter.exe | 9182 | tcp | windows | - | exporter on every monitored host |
| grafana | 3000 | tcp | * | Monitoring | |
| grafana-server | 3000 | tcp | * | Monitoring | |
| icinga2 | 5665 | tcp | linux | Monitoring | |
| nrpe | 5666 | tcp | linux | - | Nagios agent |
| snmpd | 161 | udp | linux | - | SNMP agent |
| splunkd | 9997,8000 | tcp | * | Logging | indexer (9997) or search head (8000) |
| splunkd | 8089 | tcp | * | - | management port; the universal forwarder listens on it too |
| nxlog | 514,1514,6514 | * | * | Logging | nxlog as a collector; with no listener it is an agent |
| nxlog.exe | 514,1514,6514 | * | windows | Logging | nxlog as a collector |
| fluentd | 24224 | tcp | * | Logging | |
| fluent-bit | 24224,2020 | tcp | * | - | agent |
| rsyslogd | 514 | * | linux | Logging | only when it listens; every Linux host runs it |
| syslog-ng | 514,601 | * | linux | Logging | only when it listens |
| java | 5044,9600 | tcp | * | Logging | Logstash (beats input) |
| filebeat | * | * | * | - | agent |
| bprd | 13720 | tcp | * | Backup | NetBackup primary server |
| bpcd | 13782 | tcp | * | - | NetBackup client daemon on every client and media server |
| vnetd | 13724 | tcp | * | - | NetBackup, every client |
| Veeam.Backup.Service.exe | 9392,9401 | tcp | windows | Backup | Veeam Backup and Replication server |
| VeeamTransportSvc.exe | 6162 | tcp | windows | - | Veeam data mover on proxies and repositories |
| bacula-dir | 9101 | tcp | linux | Backup | Bacula director |
| bacula-sd | 9103 | tcp | linux | Backup | Bacula storage daemon |
| bacula-fd | 9102 | tcp | linux | - | Bacula client |
| cvd.exe | 8400,8403 | tcp | windows | - | Commvault runs on clients too |
| sshd | 22 | tcp | * | - | every Linux host; not a role on its own |
| svchost.exe | 3389 | tcp | windows | - | RDP (TermService) on every Windows server; not a role on its own |
| svchost.exe | 5985,5986 | tcp | windows | - | WinRM |
| svchost.exe | 135 | tcp | windows | - | RPC endpoint mapper |
| rpcbind | 111 | * | linux | - | portmapper |
| dockerd | 2375,2376 | tcp | * | Container Host | Docker daemon with a TCP listener |
| kubelet | 10250 | tcp | linux | Container Host | Kubernetes node |
| kube-apiserver | 6443 | tcp | linux | Container Host | Kubernetes control plane |
| kube-proxy | 10256 | tcp | linux | Container Host | Kubernetes node |
| hostd | 902,443 | tcp | * | Hypervisor | VMware ESXi |
| vpxd | 443 | tcp | * | Hypervisor | vCenter |
| libvirtd | 16509 | tcp | linux | Hypervisor | KVM management |
| vmms.exe | * | tcp | windows | Hypervisor | Hyper-V management service |
| java | 50000 | tcp | * | CI | Jenkins inbound agent port; 8080 on the same host is the controller |
| gitlab-runner | * | tcp | * | - | CI agent |
| ws_ConnectionServer.exe | 443,4172,8443 | tcp | windows | VDI | Horizon connection server |
| BrokerService.exe | 80,443 | tcp | windows | VDI | Citrix delivery controller |
| picaSvc2.exe | 1494,2598 | tcp | windows | VDI | Citrix VDA (session host or desktop) |
| cupsd | 631 | tcp | linux | Print | CUPS |
| spoolsv.exe | * | tcp | windows | - | spooler on every Windows host; a print server shows many clients and needs the model pass |
| falcon-sensor | * | * | linux | - | CrowdStrike agent |
| CSFalconService.exe | * | * | windows | - | CrowdStrike agent |
| MsMpEng.exe | * | * | windows | - | Defender agent |
| TaniumClient | * | * | linux | - | Tanium agent |
| TaniumClient.exe | * | * | windows | - | Tanium agent |
| qualys-cloud-agent | * | * | linux | - | Qualys agent |
| QualysAgent.exe | * | * | windows | - | Qualys agent |
| SentinelAgent.exe | * | * | windows | - | SentinelOne agent |
| CcmExec.exe | * | * | windows | - | SCCM client |
| * | 53 | * | * | DNS | port only |
| * | 88,389,636,3268,3269 | tcp | * | Directory | port only |
| * | 1433 | tcp | * | Database | port only |
| * | 3306 | tcp | * | Database | port only |
| * | 5432 | tcp | * | Database | port only |
| * | 1521 | tcp | * | Database | port only |
| * | 27017 | tcp | * | Database | port only |
| * | 6379 | tcp | * | Cache | port only |
| * | 11211 | tcp | * | Cache | port only |
| * | 5672,9092,61616 | tcp | * | Queue | port only |
| * | 2049 | * | * | File | port only |
| * | 445 | tcp | * | File | hub only: every Windows host serves 445 |
| * | 25,587 | tcp | * | Mail | port only |
| * | 123 | udp | * | NTP | port only |
| * | 67 | udp | * | DHCP | port only |
| * | 10051 | tcp | * | Monitoring | port only |
| * | 9997,514 | * | * | Logging | port only |
| * | 13720 | tcp | * | Backup | port only |
| * | 10250,6443 | tcp | * | Container Host | port only |
| * | 902 | tcp | * | Hypervisor | port only |
| * | 80,443 | tcp | * | Web | hub only: any HTTPS listener matches |
