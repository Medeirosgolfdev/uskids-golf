/*
=============================================================
PASSO 2 DEFINITIVO v2: GetMeta → IDs directos ou Brute Force
=============================================================
1. Abrir: https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=18438
2. F12 → Console
3. Colar TUDO → Enter
4. Esperar (~30-60 min)
5. Ficheiros descarregados automaticamente
=============================================================
*/

(async function() {
  console.log('🏌️ USKids Scraper v2 - GetMeta + Smart ID Discovery');
  console.log('='.repeat(60));
  
  var TOURNAMENTS = [{"name": "2005 Mexico Classic", "year": 2005, "tournament_id": "469074", "date": "Nov 25", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=1129&t=-951583"}, {"name": "2008 European Championship", "year": 2008, "tournament_id": "466668", "date": "May 27", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=1129&t=-1782278"}, {"name": "2009 European Championship", "year": 2009, "tournament_id": "467111", "date": "May 26", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=1129&t=-2392776"}, {"name": "2010 European Championship", "year": 2010, "tournament_id": "467895", "date": "Jun 1", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=1129&t=-7793522"}, {"name": "2011 European Championship", "year": 2011, "tournament_id": "468539", "date": "May 31", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=1129&t=-8683522"}, {"name": "2012 European Championship", "year": 2012, "tournament_id": "469230", "date": "Jun 5", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=1129&t=-9823522"}, {"name": "2012 Mediterranean Open Venice", "year": 2012, "tournament_id": "465003", "date": "Sep 6", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=1129&t=-10835356"}, {"name": "European Championship 2013", "year": 2013, "tournament_id": "469502", "date": "May 28", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=1129&t=11"}, {"name": "Canadian Invitational 2014", "year": 2014, "tournament_id": "471850", "date": "Jul 7", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=1129&t=347"}, {"name": "European Championship 2014", "year": 2014, "tournament_id": "469603", "date": "May 27", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=1129&t=144"}, {"name": "British Championship", "year": 2015, "tournament_id": "490187", "date": "Aug 13", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=1129&t=1108"}, {"name": "Canadian Invitational 2015", "year": 2015, "tournament_id": "491874", "date": "Aug 17", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=1129&t=1300"}, {"name": "European Championship 2015", "year": 2015, "tournament_id": "489911", "date": "May 26", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=1129&t=1084"}, {"name": "Van Horn Cup 2015", "year": 2015, "tournament_id": "495155", "date": "May 29", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=1129&t=1199"}, {"name": "Venice Open 2015", "year": 2015, "tournament_id": "489732", "date": "Aug 21", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=1129&t=1076"}, {"name": "2016 Canadian Invitational", "year": 2016, "tournament_id": "496342", "date": "Aug 15", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=1661&t=2446"}, {"name": "British Kids Championship 2016", "year": 2016, "tournament_id": "496513", "date": "Aug 11", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=1129&t=2586"}, {"name": "European Championship 2016", "year": 2016, "tournament_id": "495899", "date": "May 31", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=1129&t=2079"}, {"name": "European Van Horn Cup 2016", "year": 2016, "tournament_id": "496834", "date": "Jun 3", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=1129&t=2857"}, {"name": "Venice Open 2016", "year": 2016, "tournament_id": "496545", "date": "Aug 19", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=1129&t=2585"}, {"name": "2017 Canadian Invitational", "year": 2017, "tournament_id": "497953", "date": "Aug 14", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=1661&t=3869"}, {"name": "Australian Open 2017", "year": 2017, "tournament_id": "497243", "date": "Jan 19", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=1129&t=3242"}, {"name": "British Kids Championship 2017", "year": 2017, "tournament_id": "498098", "date": "Aug 10", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=1129&t=4009"}, {"name": "Cancun Challenge 2017", "year": 2017, "tournament_id": "498566", "date": "Sep 16", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=1129&t=4415"}, {"name": "European Championship 2017", "year": 2017, "tournament_id": "497425", "date": "May 30", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=1129&t=3361"}, {"name": "European Van Horn Cup 2017", "year": 2017, "tournament_id": "498526", "date": "Jun 2", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=1129&t=4384"}, {"name": "Guadalajara Open 2017", "year": 2017, "tournament_id": "497863", "date": "Jun 3", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=1129&t=3785"}, {"name": "Latin American Championship 2017", "year": 2017, "tournament_id": "497808", "date": "Jul 5", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=1129&t=3733"}, {"name": "Mexico City Championship 2017", "year": 2017, "tournament_id": "499043", "date": "Dec 16", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=1129&t=4313"}, {"name": "Venice Open 2017", "year": 2017, "tournament_id": "498099", "date": "Aug 18", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=1129&t=4010"}, {"name": "Australian Open 2018", "year": 2018, "tournament_id": "498757", "date": "Jan 20", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=1129&t=4591"}, {"name": "Baja Open 2018", "year": 2018, "tournament_id": "500047", "date": "Jun 2", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=1129&t=5662"}, {"name": "British Kids Championship 2018", "year": 2018, "tournament_id": "500019", "date": "Aug 9", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=1129&t=5643"}, {"name": "Cancun Challenge 2018", "year": 2018, "tournament_id": "500495", "date": "Sep 15", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=1129&t=6066"}, {"name": "Caribbean Championship at Punta Cana 2018", "year": 2018, "tournament_id": "499823", "date": "Dec 1", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=1129&t=5468"}, {"name": "European Championship 2018", "year": 2018, "tournament_id": "499400", "date": "May 29", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=1129&t=5095"}, {"name": "European Van Horn Cup 2018", "year": 2018, "tournament_id": "499412", "date": "Jun 1", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=1129&t=5104"}, {"name": "Latin American Championship 2018", "year": 2018, "tournament_id": "499824", "date": "Jun 28", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=1129&t=5469"}, {"name": "Mexico City Championship 2018", "year": 2018, "tournament_id": "501068", "date": "Dec 14", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=1129&t=6600"}, {"name": "Venice Open 2018", "year": 2018, "tournament_id": "500020", "date": "Aug 16", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=1129&t=5663"}, {"name": "Venice Open 2018", "year": 2018, "tournament_id": "500053", "date": "Aug 16", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=1129&t=5663"}, {"name": "2018 Mexico City Championship", "year": 2019, "tournament_id": "502941", "date": "Dec 16", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=1129&t=8219"}, {"name": "Australian Open 2019", "year": 2019, "tournament_id": "501206", "date": "Apr 6", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=1129&t=6705"}, {"name": "Bajio Cup 2019", "year": 2019, "tournament_id": "501596", "date": "May 31", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=1129&t=7056"}, {"name": "British Kids Championship", "year": 2019, "tournament_id": "501905", "date": "Aug 8", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=1129&t=7314"}, {"name": "Caribbean Championship at Punta Cana 2019", "year": 2019, "tournament_id": "502301", "date": "Dec 7", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=1129&t=7641"}, {"name": "European Championship 2019", "year": 2019, "tournament_id": "501215", "date": "May 28", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=1129&t=6713"}, {"name": "European Van Horn Cup 2019", "year": 2019, "tournament_id": "501234", "date": "May 31", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=1129&t=6732"}, {"name": "Mayan Challenge 2019", "year": 2019, "tournament_id": "501879", "date": "Sep 13", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=1129&t=7291"}, {"name": "Mexico City Championship", "year": 2019, "tournament_id": "502942", "date": "Dec 16", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=1129&t=8219"}, {"name": "New Zealand Open 2019", "year": 2019, "tournament_id": "502529", "date": "Oct 13", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=1129&t=7819"}, {"name": "South American Championship 2019", "year": 2019, "tournament_id": "501877", "date": "Nov 1", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=1129&t=7284"}, {"name": "Venice Open 2019", "year": 2019, "tournament_id": "501906", "date": "Aug 22", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=1129&t=7315"}, {"name": "Australian Open 2020", "year": 2020, "tournament_id": "502989", "date": "Jan 16", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=1129&t=8243"}, {"name": "Brazil Invitational 2020", "year": 2020, "tournament_id": "503074", "date": "Feb 15", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=8389"}, {"name": "Canadian Invitational 2020", "year": 2020, "tournament_id": "503699", "date": "Aug 17", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=8878"}, {"name": "Caribbean Championship at Punta Cana 2020", "year": 2020, "tournament_id": "503570", "date": "Nov 27", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=1129&t=8769"}, {"name": "Indian Championship 2020", "year": 2020, "tournament_id": "503061", "date": "Jan 29", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=8295"}, {"name": "Panama Invitational 2020", "year": 2020, "tournament_id": "503009", "date": "Feb 27", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=8271"}, {"name": "South American Championship 2020", "year": 2020, "tournament_id": "504089", "date": "Nov 6", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=1129&t=9125"}, {"name": "The Big 5 South African Open 2020", "year": 2020, "tournament_id": "502963", "date": "Feb 21", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=8229"}, {"name": "Venice Open 2020", "year": 2020, "tournament_id": "503976", "date": "Aug 21", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=1129&t=9086"}, {"name": "Australian Challenge at Moonah Links 2021", "year": 2021, "tournament_id": "506285", "date": "Dec 20", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=11115"}, {"name": "Australian Masters 2021", "year": 2021, "tournament_id": "504738", "date": "Apr 15", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=9730"}, {"name": "Bajio Cup 2021", "year": 2021, "tournament_id": "504080", "date": "May 21", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=1129&t=9142"}, {"name": "Brazil Invitational 2021", "year": 2021, "tournament_id": "505330", "date": "Dec 16", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=10163"}, {"name": "British Kids Championship 2021", "year": 2021, "tournament_id": "504783", "date": "Aug 13", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=9776"}, {"name": "Canadian Invitational 2021", "year": 2021, "tournament_id": "504888", "date": "Aug 16", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=9869"}, {"name": "Caribbean Championship at Punta Cana 2021", "year": 2021, "tournament_id": "505826", "date": "Nov 26", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=1129&t=10692"}, {"name": "European Van Horn Cup 2020", "year": 2021, "tournament_id": "503170", "date": "Jun 4", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=1129&t=8316"}, {"name": "Irish Open 2021", "year": 2021, "tournament_id": "503440", "date": "Jul 6", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=8660"}, {"name": "Mexico City Championship 2021", "year": 2021, "tournament_id": "506553", "date": "Dec 13", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=11366"}, {"name": "NCBA Junior Series Invitational", "year": 2021, "tournament_id": "506705", "date": "Dec 9", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=11457"}, {"name": "Rome Classic 2021", "year": 2021, "tournament_id": "504394", "date": "Oct 9", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=9386"}, {"name": "South American Championship 2021", "year": 2021, "tournament_id": "506258", "date": "Oct 30", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=11095"}, {"name": "The Big 5 South African Open 2021", "year": 2021, "tournament_id": "504763", "date": "Apr 8", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=9653"}, {"name": "Vallarta Open 2021", "year": 2021, "tournament_id": "505852", "date": "Sep 17", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=10693"}, {"name": "Venice Open 2021", "year": 2021, "tournament_id": "505345", "date": "Aug 19", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=1129&t=10240"}, {"name": "Australian Challenge at Moonah Links 2022", "year": 2022, "tournament_id": "508475", "date": "Dec 12", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=13048"}, {"name": "Australian Masters 2022", "year": 2022, "tournament_id": "506906", "date": "Apr 13", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=11566"}, {"name": "Australian Open 2022", "year": 2022, "tournament_id": "507900", "date": "Sep 27", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=11756"}, {"name": "Bajio Cup 2022", "year": 2022, "tournament_id": "508087", "date": "Sep 16", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=12314"}, {"name": "Brazil Invitational 2022", "year": 2022, "tournament_id": "508967", "date": "Dec 14", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=13498"}, {"name": "British Kids Championship 2022", "year": 2022, "tournament_id": "507539", "date": "Aug 25", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=12191"}, {"name": "Canadian Invitational 2022", "year": 2022, "tournament_id": "506905", "date": "Jul 11", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=11416"}, {"name": "Caribbean Championship at Punta Cana 2022", "year": 2022, "tournament_id": "508075", "date": "Nov 25", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=12470"}, {"name": "European Championship 2022", "year": 2022, "tournament_id": "503169", "date": "May 31", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=1129&t=8300"}, {"name": "European Van Horn Cup 2022", "year": 2022, "tournament_id": "507098", "date": "Jun 3", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=1129&t=11642"}, {"name": "Indian Championship 2022", "year": 2022, "tournament_id": "508420", "date": "Nov 23", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=12985"}, {"name": "Irish Open 2022", "year": 2022, "tournament_id": "506600", "date": "Jul 5", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=11307"}, {"name": "Mexico City Championship 2022", "year": 2022, "tournament_id": "509005", "date": "Dec 17", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=13537"}, {"name": "Rome Classic 2022", "year": 2022, "tournament_id": "508006", "date": "Oct 15", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=12578"}, {"name": "South American Championship 2022", "year": 2022, "tournament_id": "507826", "date": "Nov 12", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=12445"}, {"name": "The Big 5 South African Open 2022", "year": 2022, "tournament_id": "506875", "date": "Apr 26", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=11547"}, {"name": "Vallarta Open 2022", "year": 2022, "tournament_id": "507456", "date": "May 27", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=11977"}, {"name": "Venice Open 2022", "year": 2022, "tournament_id": "507579", "date": "Aug 18", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=12229"}, {"name": "Antalya Turkish Open 2023", "year": 2023, "tournament_id": "509004", "date": "Jan 28", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=13536"}, {"name": "Australian Challenge at Moonah Links 2023", "year": 2023, "tournament_id": "510706", "date": "Dec 18", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=15097"}, {"name": "Australian Masters 2023", "year": 2023, "tournament_id": "508929", "date": "Apr 17", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=13465"}, {"name": "Australian Open 2023", "year": 2023, "tournament_id": "510417", "date": "Sep 26", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=14825"}, {"name": "Bajio Cup 2023", "year": 2023, "tournament_id": "510418", "date": "Sep 9", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=14826"}, {"name": "British Kids Championship 2023", "year": 2023, "tournament_id": "509348", "date": "Aug 10", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=13826"}, {"name": "Canadian Invitational 2023", "year": 2023, "tournament_id": "508994", "date": "Jul 10", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=13527"}, {"name": "Caribbean Championship at Punta Cana 2023", "year": 2023, "tournament_id": "510111", "date": "Nov 24", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=14538"}, {"name": "Colombian Championship 2023", "year": 2023, "tournament_id": "509926", "date": "Jun 28", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=14364"}, {"name": "European Championship 2023", "year": 2023, "tournament_id": "509040", "date": "May 30", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=13568"}, {"name": "European Van Horn Cup 2023", "year": 2023, "tournament_id": "509893", "date": "Jun 2", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=14003"}, {"name": "German Championship 2023", "year": 2023, "tournament_id": "510403", "date": "Oct 2", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=14810"}, {"name": "Indian Championship 2023", "year": 2023, "tournament_id": "510789", "date": "Dec 6", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=15176"}, {"name": "Irish Open 2023", "year": 2023, "tournament_id": "508934", "date": "Jul 11", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=13470"}, {"name": "Mexico Invitational 2023", "year": 2023, "tournament_id": "511218", "date": "Dec 9", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=15591"}, {"name": "NCBA Kenya Invitational 2023", "year": 2023, "tournament_id": "510445", "date": "Dec 15", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=14856"}, {"name": "NCBA Uganda Open 2023", "year": 2023, "tournament_id": "509010", "date": "Apr 9", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=13541"}, {"name": "New Zealand Championship 2023", "year": 2023, "tournament_id": "510486", "date": "Oct 4", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=14891"}, {"name": "Panama Invitational 2023", "year": 2023, "tournament_id": "508932", "date": "Feb 23", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=13468"}, {"name": "Rome Classic 2023", "year": 2023, "tournament_id": "510249", "date": "Oct 21", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=14670"}, {"name": "South American Championship 2023", "year": 2023, "tournament_id": "510070", "date": "Nov 3", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=14502"}, {"name": "The Big 5 South African Open 2023", "year": 2023, "tournament_id": "508928", "date": "Apr 3", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=13464"}, {"name": "United Arab Emirates Championship 2023", "year": 2023, "tournament_id": "510625", "date": "Dec 19", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=15015"}, {"name": "Vallarta Open 2023", "year": 2023, "tournament_id": "509787", "date": "May 27", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=14226"}, {"name": "Venice Open 2023", "year": 2023, "tournament_id": "509865", "date": "Aug 17", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=14302"}, {"name": "Antalya Turkish Open 2024", "year": 2024, "tournament_id": "511301", "date": "Jan 27", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=15666"}, {"name": "Australian Challenge 2024", "year": 2024, "tournament_id": "513046", "date": "Dec 9", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=17351"}, {"name": "Australian Masters 2024", "year": 2024, "tournament_id": "511363", "date": "Apr 17", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=15719"}, {"name": "Australian Open 2024", "year": 2024, "tournament_id": "512921", "date": "Sep 24", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=17227"}, {"name": "British Kids Championship 2024", "year": 2024, "tournament_id": "512510", "date": "Aug 8", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=16794"}, {"name": "Canadian Invitational 2024", "year": 2024, "tournament_id": "511734", "date": "Jul 8", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=16058"}, {"name": "Caribbean Championship at Punta Cana 2024", "year": 2024, "tournament_id": "513389", "date": "Nov 29", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=17691"}, {"name": "Colombian Championship 2024", "year": 2024, "tournament_id": "512137", "date": "Jun 26", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=16453"}, {"name": "European Championship 2024", "year": 2024, "tournament_id": "511347", "date": "May 28", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=15704"}, {"name": "European Van Horn Cup 2024", "year": 2024, "tournament_id": "511485", "date": "May 31", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=15830"}, {"name": "German Masters 2024", "year": 2024, "tournament_id": "512466", "date": "Oct 4", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=16749"}, {"name": "Indian Championship 2024", "year": 2024, "tournament_id": "513593", "date": "Dec 11", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=17894"}, {"name": "Irish Open 2024", "year": 2024, "tournament_id": "511694", "date": "Jul 9", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=16020"}, {"name": "Malaysian Championship 2024", "year": 2024, "tournament_id": "511692", "date": "Mar 5", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=16018"}, {"name": "Mexico Invitational 2024", "year": 2024, "tournament_id": "513640", "date": "Dec 7", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=17942"}, {"name": "NCBA Uganda Open 2024", "year": 2024, "tournament_id": "511644", "date": "Mar 31", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=15981"}, {"name": "New Zealand Championship 2024", "year": 2024, "tournament_id": "513045", "date": "Dec 22", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=17349"}, {"name": "Panama Invitational 2024", "year": 2024, "tournament_id": "511446", "date": "Feb 15", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=15796"}, {"name": "Rome Classic 2024", "year": 2024, "tournament_id": "512511", "date": "Oct 19", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=16795"}, {"name": "South American Championship 2024", "year": 2024, "tournament_id": "512747", "date": "Nov 1", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=17024"}, {"name": "Thailand Championship 2024", "year": 2024, "tournament_id": "511693", "date": "Apr 6", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=16019"}, {"name": "The Big 5 South African Open 2024", "year": 2024, "tournament_id": "511325", "date": "Mar 25", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=15682"}, {"name": "United Arab Emirates Championship 2024", "year": 2024, "tournament_id": "513549", "date": "Dec 17", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=17854"}, {"name": "Vallarta Open 2024", "year": 2024, "tournament_id": "512136", "date": "May 25", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=16452"}, {"name": "Venice Open 2024", "year": 2024, "tournament_id": "512117", "date": "Aug 15", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=16428"}, {"name": "Antalya Turkish Open 2025", "year": 2025, "tournament_id": "513755", "date": "Jan 30", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=18045"}, {"name": "Australian Challenge 2025", "year": 2025, "tournament_id": "515728", "date": "Oct 25", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=19886"}, {"name": "Australian Masters 2025", "year": 2025, "tournament_id": "514178", "date": "Apr 23", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=18485"}, {"name": "Australian Open 2025", "year": 2025, "tournament_id": "515559", "date": "Sep 29", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=19735"}, {"name": "Canadian Invitational 2025", "year": 2025, "tournament_id": "514715", "date": "Jul 7", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=18976"}, {"name": "Caribbean Championship at Punta Cana 2025", "year": 2025, "tournament_id": "515738", "date": "Nov 28", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=19897"}, {"name": "China Championship 2025", "year": 2025, "tournament_id": "514983", "date": "Mar 21", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=19224"}, {"name": "Colombian Championship 2025", "year": 2025, "tournament_id": "515025", "date": "Jun 25", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=19261"}, {"name": "European Championship 2025", "year": 2025, "tournament_id": "514056", "date": "May 27", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=18242"}, {"name": "European Van Horn Cup 2025", "year": 2025, "tournament_id": "514085", "date": "May 30", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=18368"}, {"name": "German Masters 2025", "year": 2025, "tournament_id": "515807", "date": "Oct 4", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=19974"}, {"name": "Indian Championship 2025", "year": 2025, "tournament_id": "516579", "date": "Dec 17", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=20676"}, {"name": "Indonesia Championship 2025", "year": 2025, "tournament_id": "516580", "date": "Oct 24", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=20677"}, {"name": "Irish Open 2025", "year": 2025, "tournament_id": "514717", "date": "Jul 9", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=18978"}, {"name": "Malaysian Championship 2025", "year": 2025, "tournament_id": "515065", "date": "Apr 9", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=19295"}, {"name": "Marco Simone Invitational 2025", "year": 2025, "tournament_id": "514135", "date": "Mar 15", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=18438"}, {"name": "Mexico Invitational 2025", "year": 2025, "tournament_id": "516538", "date": "Dec 13", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=20633"}, {"name": "NCBA Kenya Invitational 2025", "year": 2025, "tournament_id": "513893", "date": "Jan 4", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=18177"}, {"name": "NCBA Kenya Invitational 2025", "year": 2025, "tournament_id": "516883", "date": "Dec 20", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=20972"}, {"name": "New Zealand Championship 2025", "year": 2025, "tournament_id": "516552", "date": "Dec 22", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=20651"}, {"name": "Panama Invitational 2025", "year": 2025, "tournament_id": "514168", "date": "Mar 6", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=18477"}, {"name": "Paris Invitational 2025", "year": 2025, "tournament_id": "514782", "date": "Jul 6", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=18975"}, {"name": "Rome Classic 2025", "year": 2025, "tournament_id": "516026", "date": "Oct 18", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=20175"}, {"name": "South American Championship 2025", "year": 2025, "tournament_id": "516297", "date": "Oct 31", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=20428"}, {"name": "Spanish Open 2025", "year": 2025, "tournament_id": "516299", "date": "Nov 14", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=20429"}, {"name": "Thailand Championship 2025", "year": 2025, "tournament_id": "514475", "date": "Apr 4", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=18676"}, {"name": "The Big 5 South African Open 2025", "year": 2025, "tournament_id": "514059", "date": "Apr 14", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=18341"}, {"name": "United Arab Emirates Championship 2025", "year": 2025, "tournament_id": "516556", "date": "Dec 16", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=20653"}, {"name": "Vallarta Open 2025", "year": 2025, "tournament_id": "514659", "date": "May 24", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=18675"}, {"name": "Venice Open 2025", "year": 2025, "tournament_id": "515206", "date": "Aug 17", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=19418"}, {"name": "Antalya Turkish Open 2026", "year": 2026, "tournament_id": "516685", "date": "Jan 30", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=20780"}, {"name": "China Championship 2026", "year": 2026, "tournament_id": "516952", "date": "Feb 6", "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=21036"}];
  var KNOWN_SEEDS = {"469502": [63], "471850": [4247], "469603": [1755], "490187": [13517], "491874": [15810], "489911": [13211], "495155": [13209, 13211, 13213, 13214, 13215, 13216, 13217, 13219, 13220, 13222, 13224, 13228, 13229, 13231, 13232, 13234, 13237], "489732": [13107], "496342": [29510], "496513": [31199], "495899": [25156], "496834": [34447], "496545": [31183], "497953": [46721], "497243": [39043], "498098": [48424], "498566": [53374], "497425": [40513], "498526": [52985], "497863": [45702], "497808": [45052], "499043": [52128], "498099": [48435]};
  
  console.log('Torneios: ' + TOURNAMENTS.length);
  
  var allData = [];
  var errors = [];
  var totalPlayers = 0;
  var startTime = Date.now();
  var flightHistory = [];
  
  function download(data, filename) {
    var json = JSON.stringify(data, null, 2);
    var blob = new Blob([json], {type: 'application/json'});
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
  
  function sleep(ms) { return new Promise(function(r){setTimeout(r,ms);}); }
  
  function getTParam(url) {
    var m = url.match(/[&?]t=(-?\d+)/);
    return m ? m[1] : null;
  }
  
  async function getMeta(tParam) {
    try {
      var resp = await fetch('/plugins/links/admin/LinksAJAX.aspx?op=GetMeta&t=' + tParam + '&jbgr=' + Date.now() + '&c=1', {method: 'POST'});
      return JSON.parse(await resp.text());
    } catch(e) { return null; }
  }
  
  // Obter dados de um flight (ID pode ser numerico ou string)
  async function getFlight(flightId) {
    for (var tVal = 0; tVal <= 1; tVal++) {
      try {
        var url = '/plugins/links/admin/LinksAJAX.aspx?op=GetPlayerTeeTimes&f=' + encodeURIComponent(flightId) + '&r=2&p=1&t=' + tVal + '&pt=undefined&jbgr=' + Date.now() + '&c=1';
        var resp = await fetch(url, {method: 'POST'});
        var text = await resp.text();
        var data = JSON.parse(text);
        if (data.flight_players && Object.keys(data.flight_players).length > 0) {
          return data;
        }
      } catch(e) {}
    }
    return null;
  }
  
  // Brute force para torneios novos (IDs numéricos)
  async function bruteForceFlights(seedId, expectedCount, maxRange) {
    var flights = {};
    var range = maxRange || 40;
    var emptyStreak = 0;
    
    for (var id = seedId - 5; id <= seedId + range; id++) {
      var data = await getFlight(String(id));
      if (data) {
        flights[String(id)] = data;
        emptyStreak = 0;
        if (expectedCount > 0 && Object.keys(flights).length >= expectedCount) break;
      } else {
        emptyStreak++;
        if (Object.keys(flights).length > 0 && emptyStreak >= 5) break;
      }
      await sleep(120);
    }
    return flights;
  }
  
  // Descobrir seed via iframe (captura qualquer tipo de flight ID)
  async function findSeedViaIframe(iframeUrl) {
    return new Promise(function(resolve) {
      var found = null;
      var iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      
      var origOpen = XMLHttpRequest.prototype.open;
      var origSend = XMLHttpRequest.prototype.send;
      
      XMLHttpRequest.prototype.open = function(method, url) {
        this._myUrl3 = url;
        origOpen.apply(this, arguments);
      };
      XMLHttpRequest.prototype.send = function() {
        var self = this;
        this.addEventListener('load', function() {
          var url = self._myUrl3 || '';
          if (url.includes('GetPlayerTeeTimes') && !found) {
            // Capturar f= com qualquer tipo de valor (numerico ou string)
            var m = url.match(/[&?]f=([^&]+)/);
            if (m) {
              found = decodeURIComponent(m[1]);
            }
          }
        });
        origSend.apply(this, arguments);
      };
      
      document.body.appendChild(iframe);
      iframe.src = iframeUrl;
      
      var check = setInterval(function() {
        if (found) {
          clearInterval(check);
          clearTimeout(timeout);
          XMLHttpRequest.prototype.open = origOpen;
          XMLHttpRequest.prototype.send = origSend;
          try { document.body.removeChild(iframe); } catch(e) {}
          resolve(found);
        }
      }, 500);
      
      var timeout = setTimeout(function() {
        clearInterval(check);
        XMLHttpRequest.prototype.open = origOpen;
        XMLHttpRequest.prototype.send = origSend;
        try { document.body.removeChild(iframe); } catch(e) {}
        resolve(found);
      }, 10000);
    });
  }
  
  // ---- PROCESSAR TORNEIOS ----
  
  for (var ti = 0; ti < TOURNAMENTS.length; ti++) {
    var t = TOURNAMENTS[ti];
    var elapsed = ((Date.now() - startTime) / 60000).toFixed(1);
    var eta = ti > 0 ? ((Date.now() - startTime) / ti * (TOURNAMENTS.length - ti) / 60000).toFixed(0) : '?';
    
    console.log('\n[' + (ti+1) + '/' + TOURNAMENTS.length + '] 🏆 ' + t.name + ' (' + t.year + ')  [' + elapsed + 'min, ETA ' + eta + 'min]');
    
    // 1. GetMeta
    var tParam = getTParam(t.iframe_url);
    var meta = null;
    var expectedCats = 0;
    var ageGroups = {};
    var tournamentMeta = {};
    
    if (tParam) {
      meta = await getMeta(tParam);
      if (meta) {
        ageGroups = meta.age_groups || {};
        tournamentMeta = meta.tournament || {};
        expectedCats = Object.keys(ageGroups).length;
        console.log('   Meta: ' + expectedCats + ' categorias, ' + (tournamentMeta.rounds || '?') + ' rondas');
      }
    }
    
    // 2. Determinar tipo de flight IDs
    var ageGroupKeys = Object.keys(ageGroups);
    var isOldFormat = ageGroupKeys.length > 0 && ageGroupKeys[0].charAt(0) === '_';
    var flights = {};
    
    if (isOldFormat && tParam) {
      // ---- TORNEIOS ANTIGOS: construir IDs directamente ----
      console.log('   Formato antigo: a construir IDs com _' + tParam + '_...');
      
      for (var ki = 0; ki < ageGroupKeys.length; ki++) {
        var key = ageGroupKeys[ki];
        var flightId = '_' + tParam + key;  // ex: _-951583_Boys 6 Under
        var data = await getFlight(flightId);
        if (data) {
          flights[flightId] = data;
          var np = Object.keys(data.flight_players).length;
          console.log('   ✓ ' + ageGroups[key].name + ': ' + np + ' jogadores');
        } else {
          console.log('   ✗ ' + ageGroups[key].name + ': vazio');
        }
        await sleep(150);
      }
      
    } else {
      // ---- TORNEIOS NOVOS: brute force com IDs numéricos ----
      var seedId = null;
      
      // Tentar seed conhecido
      if (KNOWN_SEEDS[t.tournament_id] && KNOWN_SEEDS[t.tournament_id].length > 0) {
        seedId = KNOWN_SEEDS[t.tournament_id][0];
        console.log('   Seed conhecido: ' + seedId);
      }
      
      // Tentar via iframe
      if (!seedId) {
        console.log('   A descobrir seed via iframe...');
        var iframeSeed = await findSeedViaIframe(t.iframe_url);
        if (iframeSeed) {
          // Pode ser numerico ou string
          var numSeed = parseInt(iframeSeed);
          if (!isNaN(numSeed) && numSeed > 0) {
            seedId = numSeed;
            console.log('   Seed via iframe: ' + seedId);
          } else {
            // Se recebemos um ID tipo string do iframe, usá-lo directamente
            console.log('   Seed via iframe (string): ' + iframeSeed);
            // Tentar obter este flight e depois explorar
            var data = await getFlight(iframeSeed);
            if (data) {
              flights[iframeSeed] = data;
              // Para torneios com IDs string, tentar construir para todas as categorias
              if (iframeSeed.charAt(0) === '_' && tParam) {
                for (var ki = 0; ki < ageGroupKeys.length; ki++) {
                  var key = ageGroupKeys[ki];
                  var fId = '_' + tParam + key;
                  if (fId !== iframeSeed) {
                    var d = await getFlight(fId);
                    if (d) flights[fId] = d;
                    await sleep(150);
                  }
                }
              }
            }
          }
        }
      }
      
      // Tentar com histórico
      if (!seedId && Object.keys(flights).length === 0 && flightHistory.length > 0) {
        var lastMax = flightHistory[flightHistory.length - 1].max;
        console.log('   A tentar seed do histórico: ' + (lastMax + 1));
        seedId = lastMax + 1;
      }
      
      // Brute force se temos seed numérico
      if (seedId && Object.keys(flights).length === 0) {
        console.log('   Brute force a partir de ' + seedId + ' (esperados: ' + expectedCats + ')...');
        flights = await bruteForceFlights(seedId, expectedCats, expectedCats > 0 ? expectedCats + 15 : 30);
        
        // Se falhou, tentar range mais largo
        if (Object.keys(flights).length === 0) {
          console.log('   Nada. A tentar range mais largo...');
          flights = await bruteForceFlights(seedId - 20, expectedCats, 60);
        }
      }
    }
    
    // 3. Calcular resultados
    var numCats = Object.keys(flights).length;
    var tPlayers = 0;
    Object.values(flights).forEach(function(f) {
      tPlayers += Object.keys(f.flight_players || {}).length;
    });
    
    if (numCats === 0) {
      console.log('   ❌ Nenhuma categoria encontrada.');
      errors.push({name: t.name, year: t.year, id: t.tournament_id, iframe: t.iframe_url, error: 'No flights'});
      continue;
    }
    
    // Actualizar histórico (só IDs numéricos)
    var numericIds = Object.keys(flights).filter(function(k){return /^\d+$/.test(k);}).map(Number).sort(function(a,b){return a-b;});
    if (numericIds.length > 0) {
      flightHistory.push({min: numericIds[0], max: numericIds[numericIds.length-1]});
    }
    
    // Mapear categorias
    var flightKeys = Object.keys(flights).sort(function(a,b) {
      var na = parseInt(a), nb = parseInt(b);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      return a.localeCompare(b);
    });
    
    var ageGroupNames = Object.values(ageGroups).map(function(ag) { return ag.name; });
    var flightCategories = {};
    flightKeys.forEach(function(fId, idx) {
      // Para formato antigo, extrair nome do ID; para novo, usar ordem do GetMeta
      if (fId.charAt(0) === '_') {
        // Extrair nome: _-951583_Boys 10 → Boys 10
        var parts = fId.split('_');
        var catName = parts.slice(2).join('_').trim();
        flightCategories[fId] = catName || ('Category ' + (idx+1));
      } else {
        flightCategories[fId] = idx < ageGroupNames.length ? ageGroupNames[idx] : 'Category ' + (idx+1);
      }
    });
    
    totalPlayers += tPlayers;
    var status = numCats >= expectedCats ? '✅' : '⚠️';
    console.log('   ' + status + ' ' + numCats + '/' + expectedCats + ' categorias, ' + tPlayers + ' jogadores');
    
    allData.push({
      name: t.name,
      year: t.year,
      tournament_id: t.tournament_id,
      date: t.date,
      iframe_url: t.iframe_url,
      scraped_at: new Date().toISOString(),
      meta: {
        courses: tournamentMeta.courses || '',
        rounds: tournamentMeta.rounds || null,
        start_date: tournamentMeta.start_date || '',
        end_date: tournamentMeta.end_date || '',
        age_groups: ageGroups
      },
      num_categories: numCats,
      num_categories_expected: expectedCats,
      num_players: tPlayers,
      flight_order: flightKeys,
      flight_categories: flightCategories,
      flights: flights
    });
    
    // Backup a cada 10
    if ((ti + 1) % 10 === 0) {
      console.log('\n   💾 Backup ' + (ti+1) + '/' + TOURNAMENTS.length + ' (' + allData.length + ' torneios, ' + totalPlayers + ' jogadores)');
      download({
        metadata: {partial: true, processed: ti+1, total: TOURNAMENTS.length, tournaments_captured: allData.length, total_players: totalPlayers, generated_at: new Date().toISOString()},
        tournaments: allData
      }, 'uskids_backup_' + (ti+1) + '.json');
    }
    
    await sleep(500);
  }
  
  // ---- FINAL ----
  var totalTime = ((Date.now() - startTime) / 60000).toFixed(1);
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ COMPLETO em ' + totalTime + ' min!');
  console.log('   Torneios: ' + allData.length + '/' + TOURNAMENTS.length);
  console.log('   Jogadores: ' + totalPlayers);
  console.log('   Erros: ' + errors.length);
  
  if (errors.length > 0) {
    console.log('\n   Falhados:');
    errors.forEach(function(e) { console.log('   - ' + e.name + ' (' + e.year + '): ' + e.error); });
  }
  
  download({
    metadata: {
      description: 'USKids Golf International Tournament Results - Complete Dataset',
      total_tournaments: allData.length,
      total_players: totalPlayers,
      years: [...new Set(allData.map(function(t){return t.year;}))].sort(),
      generated_at: new Date().toISOString(),
      processing_time_minutes: parseFloat(totalTime),
      source: 'tournaments.uskidsgolf.com / signupanytime.com',
      errors: errors
    },
    tournaments: allData
  }, 'uskids_complete.json');
  
  console.log('\n📥 uskids_complete.json descarregado!');
  
  if (errors.length > 0) {
    download(errors, 'uskids_errors.json');
    console.log('📥 uskids_errors.json descarregado!');
  }
})();
