const {Sequelize}=require('sequelize');
const s=new Sequelize('episode_metadata','postgres','Ayanna123!!',{
  host:'episode-control-dev.csnow208wqtv.us-east-1.rds.amazonaws.com',
  dialect:'postgres',port:5432,
  dialectOptions:{ssl:{require:true,rejectUnauthorized:false}},
  logging:false
});
(async()=>{
  try{
    const [t]=await s.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name='universes'");
    console.log('universes table exists:', t.length>0);
  }catch(e){console.log('table check ERR:',e.message);}
  try{
    const [r]=await s.query("SELECT id,name FROM universes LIMIT 5");
    console.log('universes:', JSON.stringify(r));
  }catch(e){console.log('query ERR:',e.message);}
  try{
    const [r2]=await s.query("SELECT id,name FROM book_series LIMIT 5");
    console.log('book_series:', JSON.stringify(r2));
  }catch(e){console.log('book_series ERR:',e.message);}
  await s.close();
})();
