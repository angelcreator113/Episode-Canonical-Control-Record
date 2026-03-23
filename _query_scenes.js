const{SceneSet,SceneAngle}=require('./src/models');
(async()=>{
  const s=await SceneSet.findAll({limit:3,order:[['created_at','DESC']],include:[{model:SceneAngle,as:'angles'}]});
  s.forEach(x=>console.log(JSON.stringify({id:x.id,name:x.scene_name,base_still:!!x.base_still_url,angles:x.angles?.map(a=>({id:a.id,label:a.angle_label,status:a.generation_status}))})));
  process.exit(0);
})();
