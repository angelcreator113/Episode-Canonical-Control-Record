-- Role names, production defaults. The rehearsal passes others with psql -v.
\if :{?mig_role} \else \set mig_role postgres \endif
\if :{?app_role} \else \set app_role episode_app_dev \endif
\if :{?ro_role} \else \set ro_role prime_readonly \endif
