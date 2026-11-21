const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const retainedCsv = `Name,Team,Role,Country,IsOverseas,Price
Ruturaj Gaikwad,CSK,BAT,India,No,1800
Sanju Samson,CSK,WK,India,No,1800
Shivam Dube,CSK,AR,India,No,1200
Noor Ahmad,CSK,BOWL,Afghanistan,Yes,1000
Liam Livingstone,CSK,AR,England,Yes,875
Dewald Brevis,CSK,BAT,South Africa,Yes,220
Akeal Hosein,CSK,BOWL,West Indies,Yes,200
Jamie Overton,CSK,AR,England,Yes,150
Jack Edwards,CSK,AR,Australia,Yes,100
Anshul Kamboj,CSK,AR,India,No,340
Ayush Mhatre,CSK,BAT,India,No,30
Gurjapneet Singh,CSK,BOWL,India,No,220
Kartik Sharma,CSK,WK,India,No,30
Mukesh Choudhary,CSK,BOWL,India,No,30
Rahul Chahar,CSK,BOWL,India,No,320
Ramakrishna Ghosh,CSK,AR,India,No,30
Sarfaraz Khan,CSK,BAT,India,No,75
Shreyas Gopal,CSK,BOWL,India,No,30
Urvil Patel,CSK,WK,India,No,30
Jasprit Bumrah,MI,BOWL,India,No,1800
Suryakumar Yadav,MI,BAT,India,No,1635
Rohit Sharma,MI,BAT,India,No,1630
Tilak Varma,MI,BAT,India,No,800
Arshdeep Singh,MI,BOWL,India,No,1800
Will Jacks,MI,AR,England,Yes,525
Quinton de Kock,MI,WK,South Africa,Yes,200
Ryan Rickelton,MI,WK,South Africa,Yes,100
Mitchell Santner,MI,AR,New Zealand,Yes,200
Corbin Bosch,MI,AR,South Africa,Yes,75
Sherfane Rutherford,MI,BAT,West Indies,Yes,150
Naman Dhir,MI,AR,India,No,525
Shardul Thakur,MI,AR,India,No,200
Ashwani Kumar,MI,BOWL,India,No,30
Raghu Sharma,MI,BOWL,India,No,30
Raj Angad Bawa,MI,AR,India,No,30
Virat Kohli,RCB,BAT,India,No,2100
Rajat Patidar,RCB,BAT,India,No,1100
Phil Salt,RCB,WK,England,Yes,1150
Josh Hazlewood,RCB,BOWL,Australia,Yes,1250
Bhuvneshwar Kumar,RCB,BOWL,India,No,1075
Krunal Pandya,RCB,AR,India,No,575
Venkatesh Iyer,RCB,AR,India,No,700
Tim David,RCB,BAT,Australia,Yes,300
Jitesh Sharma,RCB,WK,India,No,1100
Devdutt Padikkal,RCB,BAT,India,No,200
Romario Shepherd,RCB,AR,West Indies,Yes,150
Nuwan Thushara,RCB,BOWL,Sri Lanka,Yes,160
Jacob Duffy,RCB,BOWL,New Zealand,Yes,100
Jordan Cox,RCB,WK,England,Yes,100
Rasikh Dar,RCB,BOWL,India,No,600
Suyash Sharma,RCB,BOWL,India,No,260
Yash Dayal,RCB,BOWL,India,No,500
Abhinandan Singh,RCB,BOWL,India,No,30
Kanishk Chouhan,RCB,AR,India,No,30
Vicky Ostwal,RCB,BOWL,India,No,30
Sunil Narine,KKR,AR,West Indies,Yes,1200
Rinku Singh,KKR,BAT,India,No,1300
Varun Chakaravarthy,KKR,BOWL,India,No,1200
Cameron Green,KKR,AR,Australia,Yes,1750
Harshit Rana,KKR,BOWL,India,No,400
Angkrish Raghuvanshi,KKR,BAT,India,No,300
Ramandeep Singh,KKR,AR,India,No,400
Finn Allen,KKR,WK,New Zealand,Yes,200
Tim Seifert,KKR,WK,New Zealand,Yes,150
Rovman Powell,KKR,BAT,West Indies,Yes,150
Vaibhav Arora,KKR,BOWL,India,No,180
Anukul Roy,KKR,AR,India,No,40
Manish Pandey,KKR,BAT,India,No,75
Kartik Tyagi,KKR,BOWL,India,No,60
Prashant Solanki,KKR,BOWL,India,No,30
Sarthak Ranjan,KKR,BAT,India,No,30
Saurabh Dubey,KKR,BOWL,India,No,30
Pat Cummins,SRH,BOWL,Australia,Yes,1800
Heinrich Klaasen,SRH,WK,South Africa,Yes,2300
Abhishek Sharma,SRH,AR,India,No,1400
Ishan Kishan,SRH,WK,India,No,1125
Nitish Kumar Reddy,SRH,AR,India,No,600
T Natarajan,SRH,BOWL,India,No,1075
Khaleel Ahmed,SRH,BOWL,India,No,480
Nathan Ellis,SRH,BOWL,Australia,Yes,200
Brydon Carse,SRH,AR,England,Yes,100
Eshan Malinga,SRH,BOWL,Sri Lanka,Yes,120
Aniket Verma,SRH,BAT,India,No,30
Harsh Dubey,SRH,AR,India,No,30
Krains Fuletra,SRH,BOWL,India,No,30
Praful Hinge,SRH,BOWL,India,No,30
Sakib Hussain,SRH,BOWL,India,No,30
Salil Arora,SRH,WK,India,No,30
Shivang Kumar,SRH,AR,India,No,30
Smaran Ravichandran,SRH,BAT,India,No,30
Riyan Parag,RR,AR,India,No,1400
Yashasvi Jaiswal,RR,BAT,India,No,1800
Ravindra Jadeja,RR,AR,India,No,1800
Dhruv Jurel,RR,WK,India,No,1400
Jofra Archer,RR,BOWL,England,Yes,1250
Mohammed Shami,RR,BOWL,India,No,1000
Ravi Bishnoi,RR,BOWL,India,No,1100
Vaibhav Sooryavanshi,RR,BAT,India,No,110
Sandeep Sharma,RR,BOWL,India,No,400
Nandre Burger,RR,BOWL,South Africa,Yes,200
Dasun Shanaka,RR,AR,Sri Lanka,Yes,75
Donovan Ferreira,RR,WK,South Africa,Yes,75
Lhuan-dre Pretorius,RR,WK,South Africa,Yes,50
Manimaran Siddharth,RR,BOWL,India,No,75
Aman Rao Perala,RR,BAT,India,No,30
Brijesh Sharma,RR,BOWL,India,No,30
Shubham Dubey,RR,BAT,India,No,80
Sushant Mishra,RR,BOWL,India,No,30
Yash Raj Punja,RR,BOWL,India,No,30
Rishabh Pant,DC,WK,India,No,2700
KL Rahul,DC,WK,India,No,1400
Axar Patel,DC,AR,India,No,1650
Tristan Stubbs,DC,BAT,South Africa,Yes,1000
David Miller,DC,BAT,South Africa,Yes,750
Mukesh Kumar,DC,BOWL,India,No,800
Kyle Jamieson,DC,BOWL,New Zealand,Yes,200
Lungi Ngidi,DC,BOWL,South Africa,Yes,100
Ashutosh Sharma,DC,BAT,India,No,380
Prithvi Shaw,DC,BAT,India,No,75
Sameer Rizvi,DC,BAT,India,No,95
Auqib Dar,DC,BOWL,India,No,30
Madhav Tiwari,DC,AR,India,No,40
Tripurana Vijay,DC,AR,India,No,30
Vipraj Nigam,DC,AR,India,No,50
Zeeshan Ansari,DC,BOWL,India,No,40
Shreyas Iyer,PBKS,BAT,India,No,2675
Hardik Pandya,PBKS,AR,India,No,1800
Yuzvendra Chahal,PBKS,BOWL,India,No,1800
Marcus Stoinis,PBKS,AR,Australia,Yes,1100
Marco Jansen,PBKS,AR,South Africa,Yes,700
Shashank Singh,PBKS,BAT,India,No,550
Prabhsimran Singh,PBKS,WK,India,No,400
Priyansh Arya,PBKS,BAT,India,No,380
Azmatullah Omarzai,PBKS,AR,Afghanistan,Yes,240
Ben Dwarshuis,PBKS,BOWL,Australia,Yes,440
Cooper Connolly,PBKS,AR,Australia,Yes,300
Xavier Bartlett,PBKS,BOWL,Australia,Yes,80
Harpreet Brar,PBKS,AR,India,No,150
Vishnu Vinod,PBKS,WK,India,No,95
Vyshak Vijaykumar,PBKS,BOWL,India,No,180
Yash Thakur,PBKS,BOWL,India,No,160
Harnoor Pannu,PBKS,BAT,India,No,30
Musheer Khan,PBKS,AR,India,No,30
Suryansh Shedge,PBKS,AR,India,No,30
Shubman Gill,GT,BAT,India,No,1650
Rashid Khan,GT,BOWL,Afghanistan,Yes,1800
Sai Sudharsan,GT,BAT,India,No,850
Jos Buttler,GT,WK,England,Yes,1575
Mohammed Siraj,GT,BOWL,India,No,1225
Kagiso Rabada,GT,BOWL,South Africa,Yes,1075
Harshal Patel,GT,BOWL,India,No,400
Washington Sundar,GT,AR,India,No,320
Prasidh Krishna,GT,BOWL,India,No,950
Glenn Phillips,GT,AR,New Zealand,Yes,200
Jason Holder,GT,AR,West Indies,Yes,200
Rahul Tewatia,GT,AR,India,No,400
Sai Kishore,GT,BOWL,India,No,200
Tom Banton,GT,WK,England,Yes,150
Anuj Rawat,GT,WK,India,No,30
Ashok Sharma,GT,BOWL,India,No,30
Gurnoor Singh Brar,GT,BOWL,India,No,130
Jayant Yadav,GT,AR,India,No,75
Kumar Kushagra,GT,WK,India,No,65
Manav Suthar,GT,BOWL,India,No,30
Mohd. Arshad Khan,GT,AR,India,No,130
Nishant Sindhu,GT,AR,India,No,30
Nicholas Pooran,LSG,WK,West Indies,Yes,2100
Mitchell Marsh,LSG,AR,Australia,Yes,340
Aiden Markram,LSG,BAT,South Africa,Yes,200
Sam Curran,LSG,AR,England,Yes,240
Josh Inglis,LSG,WK,Australia,Yes,260
Kuldeep Yadav,LSG,BOWL,India,No,1325
Mayank Yadav,LSG,BOWL,India,No,1100
Ayush Badoni,LSG,BAT,India,No,400
Mohsin Khan,LSG,BOWL,India,No,400
Abdul Samad,LSG,BAT,India,No,420
Shahbaz Ahmed,LSG,AR,India,No,240
Arjun Tendulkar,LSG,AR,India,No,30
Akash Singh,LSG,BOWL,India,No,30
Akshat Raghuwanshi,LSG,BAT,India,No,30
Arshin Kulkarni,LSG,AR,India,No,30
Digvesh Rathi,LSG,BOWL,India,No,30
Mukul Choudhary,LSG,WK,India,No,30
Prince Yadav,LSG,BOWL,India,No,30`;

const auctionPoolCsv = `Name,Role,Country,IsOverseas,BasePrice,Set,PreviousTeam
Travis Head,BAT,Australia,Yes,200,Marquee,SRH
Mitchell Starc,BOWL,Australia,Yes,200,Marquee,DC
Trent Boult,BOWL,New Zealand,Yes,200,Marquee,MI
Matheesha Pathirana,BOWL,Sri Lanka,Yes,200,Marquee,KKR
Shimron Hetmyer,BAT,West Indies,Yes,150,Marquee,RR
Deepak Chahar,BOWL,India,No,150,Fast Bowlers,MI
Avesh Khan,BOWL,India,No,150,Fast Bowlers,LSG
Wanindu Hasaranga,AR,Sri Lanka,Yes,150,All-Rounders,LSG
Rachin Ravindra,AR,New Zealand,Yes,150,All-Rounders,KKR
Lockie Ferguson,BOWL,New Zealand,Yes,150,Fast Bowlers,PBKS
Mustafizur Rahman,BOWL,Bangladesh,Yes,150,Fast Bowlers,KKR
Gerald Coetzee,BOWL,South Africa,Yes,150,Fast Bowlers,SRH
Anrich Nortje,BOWL,South Africa,Yes,150,Fast Bowlers,LSG
Pathum Nissanka,BAT,Sri Lanka,Yes,100,Batters,DC
Nitish Rana,BAT,India,No,100,Batters,DC
Tushar Deshpande,BOWL,India,No,100,Fast Bowlers,RR
Akash Deep,BOWL,India,No,100,Fast Bowlers,KKR
Dushmantha Chameera,BOWL,Sri Lanka,Yes,100,Fast Bowlers,DC
Rehan Ahmed,AR,England,Yes,100,All-Rounders,DC
Adam Milne,BOWL,New Zealand,Yes,100,Fast Bowlers,RR
Luke Wood,BOWL,England,Yes,100,Fast Bowlers,GT
Spencer Johnson,BOWL,Australia,Yes,100,Fast Bowlers,CSK
Matt Henry,BOWL,New Zealand,Yes,100,Fast Bowlers,CSK
Matthew Short,AR,Australia,Yes,100,All-Rounders,CSK
Allah Ghazanfar,BOWL,Afghanistan,Yes,100,Spinners,MI
Keshav Maharaj,BOWL,South Africa,Yes,100,Spinners,MI
Jacob Bethell,AR,England,Yes,100,All-Rounders,RCB
Nehal Wadhera,BAT,India,No,75,Batters,PBKS
Abishek Porel,WK,India,No,75,Wicketkeepers,DC
Shahrukh Khan,BAT,India,No,75,Batters,GT
Ishant Sharma,BOWL,India,No,75,Fast Bowlers,GT
Umran Malik,BOWL,India,No,75,Fast Bowlers,KKR
Jaydev Unadkat,BOWL,India,No,75,Fast Bowlers,SRH
Kamindu Mendis,AR,Sri Lanka,Yes,75,All-Rounders,SRH
Kwena Maphaka,BOWL,South Africa,Yes,75,Fast Bowlers,RR
Akash Madhwal,BOWL,India,No,75,Fast Bowlers,CSK
Rahul Tripathi,BAT,India,No,75,Batters,KKR
Blessing Muzarabani,BOWL,Zimbabwe,Yes,75,Fast Bowlers,KKR
Mitchell Owen,AR,Australia,Yes,75,All-Rounders,PBKS
George Linde,AR,South Africa,Yes,75,All-Rounders,LSG
Matthew Breetzke,BAT,South Africa,Yes,75,Batters,LSG
David Payne,BOWL,England,Yes,75,Fast Bowlers,SRH
Dilshan Madushanka,BOWL,Sri Lanka,Yes,75,Fast Bowlers,SRH
Richard Gleeson,BOWL,England,Yes,75,Fast Bowlers,RCB
Zak Foulkes,AR,New Zealand,Yes,75,All-Rounders,CSK
Connor Esterhuizen,WK,South Africa,Yes,50,Wicketkeepers,GT
Mayank Markande,BOWL,India,No,50,Spinners,MI
Mahipal Lomror,AR,India,No,50,All-Rounders,MI
Swapnil Singh,AR,India,No,50,All-Rounders,RCB
Shivam Mavi,BOWL,India,No,50,Fast Bowlers,SRH
Navdeep Saini,BOWL,India,No,50,Fast Bowlers,KKR
Karun Nair,BAT,India,No,50,Batters,DC
Kuldeep Sen,BOWL,India,No,50,Fast Bowlers,RR
Robin Minz,WK,India,No,50,Wicketkeepers,MI
Praveen Dubey,BOWL,India,No,50,Spinners,PBKS
Yudhvir Singh Charak,AR,India,No,30,Uncapped All-Rounders,RR
Vignesh Puthur,BOWL,India,No,30,Uncapped Bowlers,RR
Prashant Veer,AR,India,No,30,Uncapped All-Rounders,CSK
Aman Khan,AR,India,No,30,Uncapped All-Rounders,CSK
Dian Forrester,AR,South Africa,Yes,30,All-Rounders,CSK
Kuldip Yadav,BOWL,India,No,30,Uncapped Bowlers,CSK
Macneil Noronha,AR,India,No,30,Uncapped All-Rounders,CSK
Ajay Mandal,AR,India,No,30,Uncapped All-Rounders,DC
Sahil Parakh,BAT,India,No,30,Uncapped Batters,DC
Kulwant Khejroliya,BOWL,India,No,30,Uncapped Bowlers,GT
Prithviraj Yarra,BOWL,India,No,30,Uncapped Bowlers,GT
Daksh Kamra,AR,India,No,30,Uncapped All-Rounders,KKR
Luvnith Sisodia,WK,India,No,30,Uncapped Wicketkeepers,KKR
Tejasvi Singh,WK,India,No,30,Uncapped Wicketkeepers,KKR
Himmat Singh,BAT,India,No,30,Uncapped Batters,LSG
Naman Tiwari,BOWL,India,No,30,Uncapped Bowlers,LSG
Atharva Ankolekar,AR,India,No,30,Uncapped All-Rounders,MI
Danish Malewar,BAT,India,No,30,Uncapped Batters,MI
Krish Bhagat,BOWL,India,No,30,Uncapped Bowlers,MI
Mayank Rawat,AR,India,No,30,Uncapped All-Rounders,MI
Mohammed Izhar,BOWL,India,No,30,Uncapped Bowlers,MI
Ruchit Ahir,WK,India,No,30,Uncapped Wicketkeepers,MI
Pyla Avinash,BAT,India,No,30,Uncapped Batters,PBKS
Vishal Nishad,BOWL,India,No,30,Uncapped Bowlers,PBKS
Emanjot Singh Chahal,BOWL,India,No,30,Uncapped Bowlers,RR
Ravi Singh,WK,India,No,30,Uncapped Wicketkeepers,RR
Mangesh Yadav,BOWL,India,No,30,Uncapped Bowlers,RCB
Satvik Deswal,AR,India,No,30,Uncapped All-Rounders,RCB
Vihaan Malhotra,BAT,India,No,30,Uncapped Batters,RCB
Amit Kumar,BOWL,India,No,30,Uncapped Bowlers,SRH
Onkar Tarmale,BOWL,India,No,30,Uncapped Bowlers,SRH
RS Ambrish,AR,India,No,30,Uncapped All-Rounders,SRH`;

// 1. Write CSV files in public/
fs.writeFileSync(path.join(__dirname, '../public/ipl_2027_retained_players.csv'), retainedCsv, 'utf8');
fs.writeFileSync(path.join(__dirname, '../public/ipl_2027_auction_pool.csv'), auctionPoolCsv, 'utf8');
fs.writeFileSync(path.join(__dirname, '../public/sample_retained_squads_template.csv'), retainedCsv, 'utf8');
fs.writeFileSync(path.join(__dirname, '../public/sample_auction_pool_template.csv'), auctionPoolCsv, 'utf8');

// 2. Parse retained players and calculate team spending
const wbRetained = XLSX.read(retainedCsv, { type: 'string' });
const retainedRows = XLSX.utils.sheet_to_json(wbRetained.Sheets[wbRetained.SheetNames[0]]);

const teamSpending = {};
const teamOverseas = {};
const teamSquadCounts = {};

retainedRows.forEach((r) => {
  const team = r.Team;
  const price = Number(r.Price) || 0;
  const isOs = String(r.IsOverseas).toLowerCase() === 'yes';

  teamSpending[team] = (teamSpending[team] || 0) + price;
  teamOverseas[team] = (teamOverseas[team] || 0) + (isOs ? 1 : 0);
  teamSquadCounts[team] = (teamSquadCounts[team] || 0) + 1;
});

const TOTAL_PURSE = 13000; // 130 Cr in Lakhs
const teamPursesRows = Object.keys(teamSpending).map((team) => {
  const spent = teamSpending[team];
  const remaining = Math.max(0, TOTAL_PURSE - spent);
  return {
    Team: team,
    TotalPurse: TOTAL_PURSE,
    SpentOnRetentions: spent,
    RemainingPurse: remaining,
    RemainingPurseCr: (remaining / 100).toFixed(2),
    RetainedPlayersCount: teamSquadCounts[team],
    OverseasRetained: teamOverseas[team],
  };
});

console.log('TEAM PURSE SUMMARY (from exact retained players list):');
console.table(teamPursesRows);

// 3. Create Multi-sheet Excel workbook
const wbPool = XLSX.read(auctionPoolCsv, { type: 'string' });
const poolRows = XLSX.utils.sheet_to_json(wbPool.Sheets[wbPool.SheetNames[0]]);

const wb = XLSX.utils.book_new();
const wsTeamPurses = XLSX.utils.json_to_sheet(teamPursesRows);
const wsRetained = XLSX.utils.json_to_sheet(retainedRows);
const wsPool = XLSX.utils.json_to_sheet(poolRows);

XLSX.utils.book_append_sheet(wb, wsTeamPurses, 'TeamPurses');
XLSX.utils.book_append_sheet(wb, wsRetained, 'RetainedSquads');
XLSX.utils.book_append_sheet(wb, wsPool, 'AuctionPool');

XLSX.writeFile(wb, path.join(__dirname, '../public/IPL_2027_Mini_Auction_Template.xlsx'));
console.log('Successfully generated public/IPL_2027_Mini_Auction_Template.xlsx');
