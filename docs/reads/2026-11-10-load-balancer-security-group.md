# A security group of its own for the load balancer (read and draft, 2026-11-10)

**Status:** draft. Nothing was changed. Task #3788. Measured 2026-11-10, 22:17 UTC, from a laptop session with read-only `aws ec2`, `aws elbv2` and `aws rds` calls. Evoni runs the commands in section 3 after she says go.

> **Applied the same evening (2026-11-10, 23:00 to 23:36 UTC).** Evoni ran the five steps from CloudShell, one at a time, and each was read back before the next. The end state, as AWS reported it at 23:36 UTC:
>
> - **`primepisodes-alb-sg`** (new): in 443 and 80 from anywhere; out 3000 to `episode-backend-sg`; nothing else. The load balancer and its three network interfaces are in this group only.
> - **`episode-backend-sg`** (the prod box): in 22 from Evoni's address and 3000 from `primepisodes-alb-sg`; the 3000 rule from `default` is gone.
> - **`default`**: no members. At 23:49 UTC Evoni also removed all five of its inbound rules, after a read showed no member and no rule or resource referring to it. It now has no inbound rule, and its one outbound rule is unchanged. Section 5's first item is done.
> - **Production through every step:** the `primepisodes-backend` target stayed `healthy`; `https://primepisodes.com/`, `/health` and `/api/v1/assets` returned 200 and `http://` returned 301 on every read, including three reads 35 seconds apart after the last step. Ports 80, 443 and 3000 on the prod box do not connect from outside. SSM shows both boxes online.
>
> Two steps had to be run twice: the first attempts at steps 2 and 4 changed nothing (the read-back showed the old state), and the second attempts applied. Reading each step back before the next is what caught it; step 4 without step 2 would have cut the load balancer off from the app.
>
> Everything below is the draft as written before the change.

## Answer first

- `primepisodes-alb` is in the VPC's **`default`** security group, and nothing else is.
- The prod box (`episode-backend`) accepts port 3000 from "the `default` group". So anything that is ever put in the `default` group, which is where a resource lands when no group is chosen, could reach the production app directly.
- The draft gives the load balancer its own group, `primepisodes-alb-sg`, points the prod box's 3000 rule at it, and takes the load balancer out of `default`. Every step adds before it removes, so there is no moment when the load balancer cannot reach the app.

## 1. Current state

The load balancer and the prod box are in the account's default VPC (172.31.0.0/16).

**`default` (the load balancer's group)**

| Direction | Port | Source or destination |
|---|---|---|
| in | 443 | anywhere |
| in | 80 | anywhere |
| in | 5432 | one address (Evoni's) |
| in | 5432 | `episode-backend-sg` |
| in | all | `default` itself |
| out | all | anywhere |

**`episode-backend-sg` (the prod box)**

| Direction | Port | Source or destination |
|---|---|---|
| in | 22 | one address (Evoni's) |
| in | 3000 | `default` |
| out | all | anywhere |

**What uses `default`:** three network interfaces, all `ELB app/primepisodes-alb`. No instance, no Lambda function in the VPC, no VPC endpoint.

**What refers to `default` in a rule:** `default` itself (the all-traffic rule) and `episode-backend-sg` (the 3000 rule).

**The database is not involved.** Both RDS instances (`episode-control-dev`, `episode-control-prod`) are in other VPCs with their own groups. The two 5432 rules on `default` open nothing: nothing in `default` listens on 5432.

**What the load balancer needs:** inbound 443 and 80 from anywhere (its two listeners; 80 only redirects), and outbound 3000 to the prod box (its one target group, `primepisodes-backend`, sends traffic and health checks there). Its listeners have no authentication action, so it makes no other outbound calls.

## 2. The change

| After | Rules |
|---|---|
| `primepisodes-alb-sg` (new, the load balancer only) | in: 443 and 80 from anywhere. out: 3000 to `episode-backend-sg`, nothing else |
| `episode-backend-sg` | in: 22 from Evoni's address, 3000 from `primepisodes-alb-sg`. out: unchanged |
| `default` | unchanged by this draft, and used by nothing (see section 5) |

## 3. Commands, in order (CloudShell)

Run the first block again if the CloudShell session is restarted: every variable is looked up by name.

```bash
LB=$(aws elbv2 describe-load-balancers --names primepisodes-alb --query 'LoadBalancers[0].LoadBalancerArn' --output text)
VPC=$(aws elbv2 describe-load-balancers --names primepisodes-alb --query 'LoadBalancers[0].VpcId' --output text)
BOX=$(aws ec2 describe-security-groups --filters Name=vpc-id,Values=$VPC Name=group-name,Values=episode-backend-sg --query 'SecurityGroups[0].GroupId' --output text)
DEF=$(aws ec2 describe-security-groups --filters Name=vpc-id,Values=$VPC Name=group-name,Values=default --query 'SecurityGroups[0].GroupId' --output text)
ALB=$(aws ec2 describe-security-groups --filters Name=vpc-id,Values=$VPC Name=group-name,Values=primepisodes-alb-sg --query 'SecurityGroups[0].GroupId' --output text)
echo "LB=${LB##*/} VPC=$VPC BOX=$BOX DEF=$DEF ALB=$ALB"   # ALB is "None" until step 1
```

**Step 1. Create the new group.** Nothing uses it yet, so this changes no traffic.

```bash
ALB=$(aws ec2 create-security-group --group-name primepisodes-alb-sg --description "primepisodes-alb: 80 and 443 in, prod box 3000 out" --vpc-id $VPC --query GroupId --output text)
aws ec2 authorize-security-group-ingress --group-id $ALB --ip-permissions 'IpProtocol=tcp,FromPort=443,ToPort=443,IpRanges=[{CidrIp=0.0.0.0/0,Description="HTTPS"}]' 'IpProtocol=tcp,FromPort=80,ToPort=80,IpRanges=[{CidrIp=0.0.0.0/0,Description="HTTP, redirected to HTTPS"}]'
aws ec2 authorize-security-group-egress --group-id $ALB --ip-permissions "IpProtocol=tcp,FromPort=3000,ToPort=3000,UserIdGroupPairs=[{GroupId=$BOX,Description=\"prod app\"}]"
aws ec2 revoke-security-group-egress --group-id $ALB --ip-permissions 'IpProtocol=-1,IpRanges=[{CidrIp=0.0.0.0/0}]'
```

**Step 2. The prod box also accepts 3000 from the new group.** The existing rule stays.

```bash
aws ec2 authorize-security-group-ingress --group-id $BOX --ip-permissions "IpProtocol=tcp,FromPort=3000,ToPort=3000,UserIdGroupPairs=[{GroupId=$ALB,Description=\"from primepisodes-alb\"}]"
```

**Step 3. The load balancer is in both groups.** It keeps everything it has and gains the new group.

```bash
aws elbv2 set-security-groups --load-balancer-arn $LB --security-groups $ALB $DEF
```

Check (section 4) before going on.

**Step 4. The load balancer is in the new group only.**

```bash
aws elbv2 set-security-groups --load-balancer-arn $LB --security-groups $ALB
```

Check again, and wait for two health check intervals (about a minute) with the target still healthy.

**Step 5. Remove the prod box's old rule.** Only now does the `default` group stop reaching port 3000.

```bash
aws ec2 revoke-security-group-ingress --group-id $BOX --ip-permissions "IpProtocol=tcp,FromPort=3000,ToPort=3000,UserIdGroupPairs=[{GroupId=$DEF}]"
```

**Why there is no downtime:** at every point the load balancer is in at least one group that the prod box accepts on 3000, and that allows it to send to 3000. Steps 1 and 2 only add. Step 3 adds a group. Step 4 removes `default` from the load balancer after the new group's rules are already in place on both sides. Step 5 removes a rule that nothing uses any more.

## 4. Verification

After steps 3, 4 and 5:

```bash
aws elbv2 describe-load-balancers --names primepisodes-alb --query 'LoadBalancers[0].SecurityGroups' --output text
aws elbv2 describe-target-health --target-group-arn $(aws elbv2 describe-target-groups --names primepisodes-backend --query 'TargetGroups[0].TargetGroupArn' --output text) --query 'TargetHealthDescriptions[].TargetHealth.State' --output text   # healthy
curl -s -o /dev/null -w '%{http_code}\n' https://primepisodes.com/health        # 200
curl -s -o /dev/null -w '%{http_code}\n' https://primepisodes.com/              # 200
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' http://primepisodes.com/   # 301 https://primepisodes.com:443/
```

At the end:

```bash
aws ec2 describe-security-group-rules --filters Name=group-id,Values=$BOX --query 'SecurityGroupRules[?IsEgress==`false`].[FromPort,CidrIpv4,ReferencedGroupInfo.GroupId]' --output text   # 22 from one address; 3000 from $ALB only
aws ec2 describe-security-group-rules --filters Name=group-id,Values=$ALB --query 'SecurityGroupRules[].[IsEgress,FromPort,CidrIpv4,ReferencedGroupInfo.GroupId]' --output text            # in 443, in 80, out 3000 to $BOX
aws ec2 describe-network-interfaces --filters Name=group-id,Values=$DEF --query 'length(NetworkInterfaces)' --output text                                                                # 0
```

Also: a production deploy's "Public health check" step uses `https://primepisodes.com/health` through the load balancer, so the checks above cover it. SSM does not depend on any of these rules.

## Undo

Undo in reverse, from wherever the change stopped.

```bash
# Step 5: give the prod box its old rule back
aws ec2 authorize-security-group-ingress --group-id $BOX --ip-permissions "IpProtocol=tcp,FromPort=3000,ToPort=3000,UserIdGroupPairs=[{GroupId=$DEF}]"
# Steps 4 and 3: the load balancer back in default only (needs the old rule above to be present)
aws elbv2 set-security-groups --load-balancer-arn $LB --security-groups $DEF
# Step 2: remove the new group's rule from the prod box
aws ec2 revoke-security-group-ingress --group-id $BOX --ip-permissions "IpProtocol=tcp,FromPort=3000,ToPort=3000,UserIdGroupPairs=[{GroupId=$ALB}]"
# Step 1: delete the new group (only once nothing uses or refers to it)
aws ec2 delete-security-group --group-id $ALB
```

## 5. Left for later (not in this draft)

- **The `default` group keeps its rules.** After this change nothing is in it, but anything launched later without a group chosen would be: it would accept 80 and 443 from anywhere, and 5432 from Evoni's address and from the prod box. Removing all of `default`'s inbound rules, so that landing in it grants nothing, is a separate change. It can only be done after step 4.
- **The dev box and the stopped `episode-frontend` instance** have their own groups and are not touched.

## Evidence (commands run, all read-only)

```
aws ec2 describe-security-group-rules --filters Name=group-id,Values=<default>            (and the same for episode-backend-sg)
aws ec2 describe-network-interfaces --filters Name=group-id,Values=<default>
aws ec2 describe-security-groups --filters Name=vpc-id,Values=<vpc>
aws ec2 describe-security-groups --filters Name=ip-permission.group-id,Values=<default>
aws ec2 describe-security-groups --filters Name=egress.ip-permission.group-id,Values=<default>
aws ec2 describe-vpcs --vpc-ids <vpc>
aws ec2 describe-vpc-endpoints --filters Name=vpc-id,Values=<vpc>
aws lambda list-functions
aws rds describe-db-instances
aws elbv2 describe-load-balancers --names primepisodes-alb
aws elbv2 describe-listeners, describe-target-groups, describe-target-health
```

Network interfaces in `default`, as returned:

```
interface  ELB app/primepisodes-alb/...  in-use
interface  ELB app/primepisodes-alb/...  in-use
interface  ELB app/primepisodes-alb/...  in-use
```

RDS instances and their VPCs, as returned: `episode-control-dev` and `episode-control-prod`, each in a VPC other than the load balancer's.
