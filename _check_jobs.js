require('dotenv').config({path:'/home/ubuntu/episode-metadata/.env'});
const {GenerationJob} = require('/home/ubuntu/episode-metadata/src/models');
GenerationJob.findAll({
  attributes:['id','job_type','status','attempts','max_attempts','error','created_at'],
  order:[['created_at','DESC']],
  limit:20
}).then(jobs => {
  const data = jobs.map(j => ({
    id: j.id,
    type: j.job_type,
    status: j.status,
    attempts: j.attempts,
    max: j.max_attempts,
    error: j.error,
    created: j.created_at,
  }));
  console.log(JSON.stringify(data, null, 2));
  process.exit(0);
}).catch(e => { console.error(e.message); process.exit(1); });
