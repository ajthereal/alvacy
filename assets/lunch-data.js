/* What's For Lunch? menu data. The only file to edit to add or fix a dish.

   Each dish: [name in Indonesian, name in English, kcal, protein in grams, tip in Indonesian, tip in English]
   - kcal and protein are for one typical restaurant portion, rounded. They are estimates (about +/- 20%), not lab values.
   - The green / yellow / red rating is not typed here. The page works it out from kcal and protein (see rate() in lunch/index.html),
     so every dish is judged by the same rule.
   - A group with drink:true is rated on calories only (drinks and desserts).
   Keep tips short: one concrete thing to say when ordering. */
window.LUNCH = {
 modes: [
  { k: 'office', groups: [
   { k: 'warteg', name: { id: 'Warteg & nasi campur', en: 'Warteg & mixed rice' }, items: [
    ['Nasi ½ + ayam bakar + tumis sayur', 'Half rice + grilled chicken + stir-fried greens', 520, 32, 'Minta nasi setengah, sayur dobel.', 'Ask for half rice and double greens.'],
    ['Nasi ½ + pepes ikan + sayur bening', 'Half rice + steamed fish parcel + clear veg soup', 470, 30, 'Pepes itu dikukus, bukan digoreng. Pilihan paling aman di warteg.', 'Steamed, not fried. The safest pick at a warteg.'],
    ['Nasi ½ + telur rebus 2 + tahu tempe bacem + sayur', 'Half rice + 2 boiled eggs + braised tofu & tempeh + veg', 500, 28, 'Pilih yang bacem atau rebus, bukan goreng.', 'Pick braised or boiled, not fried.'],
    ['Nasi 1 + ikan lele goreng + lalapan + sambal', 'Rice + fried catfish + raw veg + sambal', 650, 30, 'Lele goreng menyerap minyak. Buang kulit gorengnya kalau bisa.', 'Fried catfish soaks up oil. Skip the crispy skin if you can.'],
    ['Nasi 1 + ayam goreng + orek tempe + sayur lodeh', 'Rice + fried chicken + tempeh stir-fry + veg in coconut', 780, 32, 'Ganti sayur lodeh (santan) dengan tumis atau sayur bening.', 'Swap the coconut veg for a stir-fry or clear soup.'],
    ['Nasi 1 + telur dadar + tahu tempe goreng + sayur', 'Rice + omelette + fried tofu & tempeh + veg', 700, 26, 'Telur dadar warteg banyak minyak. Telur rebus atau ceplok sedikit minyak lebih ringan.', 'Warteg omelettes are oily. Boiled or lightly fried eggs are lighter.'],
    ['Nasi 1 + rendang + sayur nangka + gulai', 'Rice + rendang + jackfruit curry + gulai', 920, 30, 'Rendang dan gulai itu santan dan minyak. Ambil sepotong saja, tanpa kuah.', 'Rendang and gulai are coconut and oil. One piece, no gravy.'],
    ['Nasi 1 + ayam goreng + perkedel + kerupuk + es teh manis', 'Rice + fried chicken + potato fritter + crackers + sweet iced tea', 1100, 33, 'Ganti es teh manis dengan teh tawar. Itu sendiri sekitar 150 kkal.', 'Swap the sweet iced tea for plain tea. That alone saves about 150 kcal.']
   ]},
   { k: 'kantin', name: { id: 'Kantin & food court', en: 'Canteen & food court' }, items: [
    ['Salad bar + ayam panggang', 'Salad bar + grilled chicken', 380, 32, 'Dressing di samping, ambil secukupnya.', 'Dressing on the side, just a little.'],
    ['Soto ayam + nasi sedikit', 'Chicken soto + a little rice', 450, 26, 'Kuah bening itu ringan. Hindari soto santan.', 'Clear broth is light. Avoid coconut-milk soto.'],
    ['Nasi ayam hainan', 'Hainanese chicken rice', 610, 27, 'Buang kulit ayamnya dan minta nasi setengah.', 'Take off the chicken skin and ask for half rice.'],
    ['Gado-gado + telur', 'Gado-gado with egg', 480, 18, 'Bumbu kacang dipisah, cocol sedikit saja.', 'Peanut sauce on the side, dip lightly.'],
    ['Pecel sayur + tempe + nasi', 'Pecel vegetables + tempeh + rice', 560, 18, 'Nasi setengah dan tambah telur rebus biar proteinnya naik.', 'Half rice and add a boiled egg for more protein.'],
    ['Bakso urat (tanpa mie)', 'Beef meatball soup (no noodles)', 420, 24, 'Tanpa mie dan gorengan, kuah jangan dihabiskan.', 'No noodles or fried bits, leave some broth.'],
    ['Mie ayam bakso', 'Chicken noodles with meatballs', 650, 22, 'Minta mienya setengah dan tambah bakso.', 'Ask for half the noodles and extra meatballs.'],
    ['Bubur ayam', 'Chicken congee', 400, 15, 'Tambah telur dan suwiran ayam, kurangi kerupuk dan cakwe.', 'Add egg and shredded chicken, go easy on crackers and fried dough.'],
    ['Nasi goreng ayam', 'Chicken fried rice', 700, 18, 'Nasi goreng itu banyak minyak dan sedikit protein. Sesekali saja.', 'Lots of oil, little protein. An occasional one.'],
    ['Soto betawi + nasi', 'Soto Betawi + rice', 800, 22, 'Kuahnya santan dan susu. Pilih soto bening kalau ada.', 'The broth is coconut and milk. Pick a clear soto if you can.']
   ]},
   { k: 'warung', name: { id: 'Warung & gerobak', en: 'Street stalls' }, items: [
    ['Sate ayam 10 tusuk + lontong', 'Chicken satay 10 sticks + rice cake', 520, 36, 'Bumbu kacang secukupnya, lontongnya satu saja.', 'Light on the peanut sauce, one rice cake only.'],
    ['Siomay + tahu + kol (bumbu sedikit)', 'Fish dumplings + tofu + cabbage (light sauce)', 380, 20, 'Siomay itu dikukus. Bumbu kacang pisah.', 'Steamed. Ask for the sauce on the side.'],
    ['Pempek kapal selam + cuko', 'Pempek with egg + cuko sauce', 450, 18, 'Pilih yang direbus, bukan digoreng. Cuko gulanya lumayan.', 'Choose boiled over fried. The cuko has quite a bit of sugar.'],
    ['Ketoprak', 'Ketoprak', 520, 17, 'Minta bumbu kacang sedikit dan tambah tahu.', 'Ask for less peanut sauce and extra tofu.'],
    ['Lontong sayur + telur', 'Lontong in veg curry + egg', 560, 15, 'Kuah santan, jadi lontongnya setengah saja.', 'Coconut broth, so half the rice cake.'],
    ['Batagor 5 pcs + bumbu kacang', 'Fried fish dumplings 5 pcs + peanut sauce', 600, 20, 'Digoreng dan bumbu kacang. Boleh, tapi jangan tiap hari.', 'Fried and with peanut sauce. Fine now and then.'],
    ['Martabak telur (1 potong besar)', 'Savoury martabak (1 big slice)', 400, 14, 'Satu potong cukup, jangan makan sendirian satu loyang.', 'One slice is plenty. Don’t take down the whole tray.'],
    ['Tahu gejrot + telur', 'Tahu gejrot + egg', 300, 16, 'Ringan dan murah. Cocok buat ganjal.', 'Light and cheap. A good fill-up.'],
    ['Gorengan 4 pcs (bakwan, tahu isi)', 'Fried snacks 4 pcs', 420, 6, 'Gorengan itu cepat habis dan nggak bikin kenyang. Pilih 1 atau 2.', 'Quick to eat, doesn’t fill you up. Stick to one or two.']
   ]},
   { k: 'padang', name: { id: 'Padang', en: 'Padang' }, note: { id: 'Lebih detail? Pakai Padang builder di halaman Tools.', en: 'Want more detail? Use the Padang builder on the Tools page.' }, items: [
    ['Nasi ½ + ayam bakar + sayur daun singkong', 'Half rice + grilled chicken + cassava leaves', 560, 34, 'Ayam bakar atau ayam pop, bukan ayam goreng balado.', 'Grilled or pop chicken, not fried with balado.'],
    ['Nasi ½ + ikan bakar + sayur + sambal ijo', 'Half rice + grilled fish + veg + green chilli', 520, 34, 'Sambal ijo itu ringan. Santan yang harus dihindari.', 'Green chilli is light. Coconut is what to avoid.'],
    ['Nasi ½ + telur dadar Padang + sayur', 'Half rice + Padang omelette + veg', 540, 20, 'Tambah satu lauk protein lain biar lebih kenyang.', 'Add one more protein side to stay fuller.'],
    ['Nasi 1 + rendang + gulai nangka + sambal', 'Rice + rendang + jackfruit gulai + sambal', 950, 30, 'Pilih salah satu: rendang atau gulai. Dua-duanya santan.', 'Pick one: rendang or gulai. Both are coconut.'],
    ['Nasi 1 + gulai kepala ikan', 'Rice + fish head curry', 880, 38, 'Protein tinggi tapi kuahnya santan. Kuahnya cukup sesendok.', 'High protein but coconut broth. One spoon of gravy is enough.'],
    ['Nasi 1 + dendeng balado + sayur', 'Rice + crispy beef with chilli + veg', 840, 28, 'Dendeng itu digoreng dan balado minyak. Sesekali saja.', 'Fried and oily. Only now and then.'],
    ['Nasi 1 + ayam goreng + terong balado + gulai', 'Rice + fried chicken + eggplant balado + gulai', 1020, 30, 'Banyak minyak dan santan sekaligus. Kurangi satu lauknya.', 'Oil and coconut at once. Drop one of the sides.']
   ]},
   { k: 'minimarket', name: { id: 'Minimarket', en: 'Convenience store' }, items: [
    ['Telur rebus 2 + yogurt tawar', '2 boiled eggs + plain yogurt', 250, 22, 'Kombinasi cepat dan protein tinggi.', 'Fast, high protein.'],
    ['Dada ayam siap makan + salad', 'Ready-to-eat chicken breast + salad', 260, 32, 'Cari yang kemasan dingin, cek sodiumnya.', 'Look for the chilled pack, and check the sodium.'],
    ['Sandwich telur gandum', 'Egg wholegrain sandwich', 300, 14, 'Pilih roti gandum, tambah telur rebus.', 'Pick wholegrain and add a boiled egg.'],
    ['Onigiri tuna mayo + telur rebus', 'Tuna mayo onigiri + boiled egg', 330, 15, 'Onigiri satu saja dan telurnya dua.', 'One onigiri, two eggs.'],
    ['Susu UHT plain + pisang', 'Plain UHT milk + banana', 280, 10, 'Pilih yang plain, bukan coklat atau stroberi.', 'Plain, not chocolate or strawberry.'],
    ['Protein bar + air putih', 'Protein bar + water', 220, 15, 'Cek gulanya di label. Di bawah 8 g lebih baik.', 'Check the sugar on the label. Under 8 g is better.'],
    ['Nasi ayam bakar microwave', 'Microwave grilled-chicken rice box', 520, 24, 'Tambah telur rebus dan buang sedikit nasinya.', 'Add a boiled egg and leave a little rice.'],
    ['Mie cup + telur', 'Instant noodle cup + egg', 470, 14, 'Setengah bumbu saja, kuah jangan dihabiskan.', 'Half the seasoning, don’t finish the broth.'],
    ['Roti sobek coklat + kopi susu kemasan', 'Chocolate pull-apart bread + milk coffee', 520, 10, 'Gula dan lemaknya tinggi, protein rendah. Bikin lapar lagi sejam kemudian.', 'High sugar and fat, low protein. You’ll be hungry again in an hour.']
   ]},
   { k: 'box', name: { id: 'Nasi kotak & katering meeting', en: 'Meeting boxes & catering' }, items: [
    ['Nasi kotak ayam bakar + lalap', 'Box: grilled chicken + raw veg', 640, 34, 'Makan lauk dan sayur dulu, nasi belakangan.', 'Eat the protein and veg first, rice last.'],
    ['Nasi kotak ayam goreng + sambal', 'Box: fried chicken + sambal', 800, 32, 'Buang kulit ayamnya, nasi sisakan sepertiga.', 'Peel off the skin, leave a third of the rice.'],
    ['Nasi kuning komplit', 'Yellow rice set', 760, 22, 'Nasinya gurih santan. Makan setengah, lauknya habiskan.', 'The rice is cooked in coconut milk. Half the rice, all the sides.'],
    ['Nasi liwet + ayam + lalap', 'Nasi liwet + chicken + raw veg', 780, 28, 'Pilih lalapan banyak, sambal secukupnya.', 'Take lots of raw veg, a little sambal.'],
    ['Bento: ayam teriyaki + salad', 'Bento: teriyaki chicken + salad', 620, 30, 'Saus teriyaki itu manis. Pisahkan sausnya.', 'Teriyaki sauce is sweet. Keep it on the side.'],
    ['Snack box: risol, lemper, kue basah', 'Snack box: rissole, sticky rice, cakes', 520, 10, 'Ambil satu saja, lalu tambah buah atau telur kalau ada.', 'Take one piece, then add fruit or an egg if there is any.'],
    ['Prasmanan: sup + ayam + tumis sayur + nasi ½', 'Buffet: soup + chicken + stir-fried veg + half rice', 540, 32, 'Piring pertama: sayur dan protein. Nasi paling akhir.', 'First plate: veg and protein. Rice last.']
   ]}
  ]},

  { k: 'delivery', groups: [
   { k: 'ayam', name: { id: 'Ayam & bebek', en: 'Chicken & duck' }, items: [
    ['Ayam bakar + lalap (tanpa nasi)', 'Grilled chicken + raw veg (no rice)', 360, 34, 'Tanpa nasi, atau nasi kecil saja.', 'No rice, or a small one.'],
    ['Ayam bakar + nasi ½ + lalap', 'Grilled chicken + half rice + raw veg', 560, 35, 'Pilih sambal terpisah, minta nasi setengah.', 'Sambal on the side, half rice.'],
    ['Sate ayam 10 tusuk + lontong', 'Chicken satay 10 sticks + rice cake', 520, 36, 'Bumbu kacang sedikit, lontong satu.', 'Light on the sauce, one rice cake.'],
    ['Ayam penyet + tahu tempe + nasi', 'Smashed fried chicken + tofu & tempeh + rice', 800, 32, 'Ayam bakar penyet jauh lebih ringan dari goreng.', 'Grilled penyet is far lighter than fried.'],
    ['Ayam geprek + nasi', 'Crispy smashed chicken + rice', 820, 30, 'Pilih ayam tanpa tepung kalau ada dan sambalnya pisah.', 'Pick the no-batter version if offered, sambal on the side.'],
    ['Ayam kremes + nasi', 'Crispy kremes chicken + rice', 760, 30, 'Kremesnya itu minyak. Sisakan sebagian.', 'The kremes is mostly oil. Leave some.'],
    ['Bebek goreng + nasi', 'Fried duck + rice', 900, 34, 'Bebek itu berlemak. Buang kulitnya.', 'Duck is fatty. Remove the skin.'],
    ['Ayam geprek keju mozzarella + nasi', 'Cheesy smashed chicken + rice', 1020, 38, 'Hindari topping keju tambahan, itu 200 kkal sendiri.', 'Skip the extra cheese, it’s 200 kcal by itself.']
   ]},
   { k: 'bowl', name: { id: 'Rice bowl & nasi', en: 'Rice bowls' }, items: [
    ['Salmon poke bowl', 'Salmon poke bowl', 560, 30, 'Saus mayo pedas dibatasi, minta sedikit.', 'Go light on the spicy mayo.'],
    ['Chicken teriyaki bowl', 'Chicken teriyaki bowl', 680, 30, 'Nasi setengah dan saus di samping.', 'Half rice, sauce on the side.'],
    ['Beef yakiniku bowl', 'Beef yakiniku bowl', 740, 26, 'Daging tipis itu enak tapi sausnya manis. Nasi setengah.', 'Thin beef is tasty but the sauce is sweet. Half rice.'],
    ['Bibimbap', 'Bibimbap', 600, 22, 'Gochujang secukupnya, tambahkan telur.', 'A little gochujang, add the egg.'],
    ['Nasi ayam hainan', 'Hainanese chicken rice', 610, 27, 'Buang kulit ayam, nasi setengah.', 'Remove the skin, half rice.'],
    ['Nasi uduk + ayam + telur', 'Nasi uduk + chicken + egg', 820, 28, 'Nasi uduk itu santan. Setengah porsi nasi saja.', 'Nasi uduk is cooked in coconut. Half the rice.'],
    ['Nasi gudeg komplit', 'Nasi gudeg set', 720, 22, 'Gudeg itu manis. Pilih sayur dan telur, kurangi krecek.', 'Gudeg is sweet. Take veg and egg, go easy on the krecek.'],
    ['Chicken katsu curry rice', 'Chicken katsu curry rice', 960, 28, 'Dua hal digoreng dan dikuah: pilih satu. Curry di samping.', 'Fried and sauced at once. Pick one, curry on the side.']
   ]},
   { k: 'mie', name: { id: 'Bakso, soto & mie', en: 'Soups & noodles' }, items: [
    ['Soto ayam bening (tanpa nasi)', 'Clear chicken soto (no rice)', 300, 22, 'Tambah telur rebus.', 'Add a boiled egg.'],
    ['Bakso urat + sayur', 'Beef meatballs + greens', 430, 25, 'Tanpa mie atau mie sedikit.', 'No noodles or just a few.'],
    ['Sop buntut', 'Oxtail soup', 450, 30, 'Tanpa nasi goreng pendampingnya. Sop saja sudah mengenyangkan.', 'Skip the fried rice on the side. The soup alone is filling.'],
    ['Sop ayam + nasi ½', 'Chicken soup + half rice', 470, 25, 'Pilihan paling aman kalau lagi pesan online dan nggak mikir.', 'The safest pick when you just want to order and not think.'],
    ['Soto betawi (tanpa nasi)', 'Soto Betawi (no rice)', 520, 22, 'Kuah santan. Setengah porsi cukup.', 'Coconut broth. Half is enough.'],
    ['Mie ayam bakso', 'Chicken noodles with meatballs', 650, 22, 'Mie setengah, tambah bakso.', 'Half noodles, extra meatballs.'],
    ['Kwetiau goreng seafood', 'Seafood fried flat noodles', 760, 24, 'Berminyak. Kalau mau, minta sedikit minyak.', 'Oily. Ask for less oil if you can.'],
    ['Mie goreng + telur', 'Fried noodles + egg', 720, 16, 'Protein rendah, minyak banyak. Sesekali.', 'Low protein, lots of oil. Occasionally.'],
    ['Indomie goreng + telur + kerupuk', 'Instant fried noodles + egg + crackers', 580, 15, 'Pakai setengah bumbu dan tambah sayur.', 'Use half the seasoning and add veg.']
   ]},
   { k: 'fastfood', name: { id: 'Fast food', en: 'Fast food' }, items: [
    ['Subway 6" chicken teriyaki (roti gandum)', 'Subway 6" teriyaki chicken (wholegrain)', 380, 24, 'Banyakin sayur, saus ringan.', 'Pile on the veg, light sauce.'],
    ['KFC: 1 ayam original + nasi + sayur', 'KFC: 1 original chicken + rice + veg', 620, 30, 'Lepas kulitnya, itu mengurangi sekitar 100 kkal.', 'Remove the skin, saves roughly 100 kcal.'],
    ['McD: McChicken', 'McD: McChicken', 410, 15, 'Cukup mengenyangkan kalau ditambah salad atau telur.', 'Add a side salad or egg to make it fill you up.'],
    ['McD: Big Mac', 'McD: Big Mac', 580, 26, 'Jangan tambah kentang dan minuman manis.', 'No fries and no sugary drink.'],
    ['McD: 2 ayam + nasi', 'McD: 2 pieces chicken + rice', 760, 34, 'Ayamnya digoreng. Satu ayam dan nasi cukup.', 'It’s fried. One piece with rice is enough.'],
    ['Burger King: Whopper', 'Burger King: Whopper', 670, 28, 'Tanpa mayo kurangi sekitar 100 kkal.', 'Hold the mayo and save about 100 kcal.'],
    ['Pizza 2 slice (thin crust)', 'Pizza 2 slices (thin crust)', 560, 22, 'Thin crust, topping ayam atau sayur, tanpa extra keju.', 'Thin crust, chicken or veg topping, no extra cheese.'],
    ['Kentang goreng large', 'Large fries', 450, 5, 'Hampir tanpa protein. Kalau mau, share.', 'Almost no protein. Share if you must.'],
    ['Combo burger + kentang + soda', 'Burger + fries + soda combo', 1150, 28, 'Tiga hal kalori sekaligus. Pilih dua dari tiga.', 'Three calorie hits at once. Pick two of the three.']
   ]},
   { k: 'sehat', name: { id: 'Salad & makanan sehat', en: 'Salads & healthy bowls' }, items: [
    ['Grilled chicken salad (dressing di samping)', 'Grilled chicken salad (dressing on the side)', 380, 35, 'Dressing di samping, itu biasanya 150 kkal sendiri.', 'Dressing on the side, it’s often 150 kcal alone.'],
    ['Tuna salad bowl', 'Tuna salad bowl', 340, 30, 'Tuna dalam air, bukan minyak.', 'Tuna in water, not oil.'],
    ['Caesar salad + ayam', 'Caesar salad with chicken', 540, 30, 'Dressing caesar dan crouton itu yang bikin tinggi. Minta dressing sedikit.', 'The dressing and croutons are what push it up. Ask for less.'],
    ['Buddha bowl (quinoa, tahu, sayur)', 'Buddha bowl (quinoa, tofu, veg)', 520, 20, 'Cek sausnya. Tahini dan peanut itu padat kalori.', 'Check the sauce. Tahini and peanut are calorie-dense.'],
    ['Sandwich kalkun gandum', 'Turkey wholegrain sandwich', 350, 22, 'Tanpa mayo dan tambahkan sayur.', 'No mayo, add veg.'],
    ['Overnight oats', 'Overnight oats', 330, 12, 'Cek gulanya. Madu dan sirup itu cepat naik.', 'Check the sugar. Honey and syrup add up fast.'],
    ['Protein shake', 'Protein shake', 200, 25, 'Cocok buat tambahan, bukan pengganti makan.', 'A good add-on, not a meal replacement.'],
    ['Smoothie bowl', 'Smoothie bowl', 380, 8, 'Terlihat sehat tapi gulanya dari buah dan topping. Protein rendah.', 'Looks healthy but it’s fruit and topping sugar. Low protein.']
   ]},
   { k: 'jepang', name: { id: 'Jepang: sushi, ramen & bento', en: 'Japanese: sushi, ramen & bento' }, items: [
    ['Sashimi salmon 10 pcs', 'Salmon sashimi 10 pcs', 300, 40, 'Protein tertinggi per kalori di daftar ini.', 'The best protein per calorie on this list.'],
    ['Sushi nigiri 8 pcs', 'Nigiri sushi 8 pcs', 380, 22, 'Pilih nigiri, bukan roll bermayo.', 'Choose nigiri over mayo-based rolls.'],
    ['Ramen shoyu', 'Shoyu ramen', 520, 24, 'Kuah jangan dihabiskan, itu sodium dan lemak.', 'Don’t finish the broth, it’s salt and fat.'],
    ['Ramen tonkotsu', 'Tonkotsu ramen', 780, 28, 'Kuah babi itu lemak. Tambah telur, kurangi mie setengah.', 'The pork broth is fat. Add an egg, eat half the noodles.'],
    ['Chicken teriyaki bento', 'Chicken teriyaki bento', 640, 30, 'Sausnya manis. Pisahkan.', 'Sauce on the side, it’s sweet.'],
    ['Gyudon', 'Gyudon beef bowl', 720, 26, 'Nasi setengah dan tambah miso soup.', 'Half rice and add miso soup.'],
    ['Chicken katsu bento', 'Chicken katsu bento', 880, 32, 'Digoreng tepung. Buang sebagian tepungnya atau pilih grilled.', 'Breaded and fried. Peel some off or choose grilled.'],
    ['Tempura udon', 'Tempura udon', 720, 20, 'Tempura menyerap minyak. Satu atau dua saja.', 'Tempura soaks up oil. One or two pieces.']
   ]},
   { k: 'kopi', name: { id: 'Kopi, teh & minuman', en: 'Coffee, tea & drinks' }, drink: true, items: [
    ['Americano / kopi hitam', 'Americano / black coffee', 5, 0, 'Hampir nol kalori.', 'Almost zero calories.'],
    ['Teh tawar / green tea', 'Plain tea / green tea', 0, 0, 'Teh tanpa gula itu tidak ada kalori.', 'Unsweetened tea has none.'],
    ['Air kelapa muda', 'Fresh coconut water', 60, 1, 'Boleh, tapi tetap ada gulanya.', 'Fine, but it still has sugar.'],
    ['Cappuccino', 'Cappuccino', 120, 6, 'Susu rendah lemak mengurangi sekitar 30 kkal.', 'Low-fat milk saves about 30 kcal.'],
    ['Latte', 'Latte', 190, 9, 'Minta tanpa sirup tambahan.', 'No extra syrup.'],
    ['Es kopi susu gula aren', 'Iced palm-sugar milk coffee', 250, 6, 'Gula aren ½ atau less sugar.', 'Ask for half the palm sugar.'],
    ['Matcha latte', 'Matcha latte', 240, 8, 'Matcha kafe biasanya sudah dimaniskan. Minta less sugar.', 'Café matcha is usually pre-sweetened. Ask for less sugar.'],
    ['Es teh manis', 'Sweet iced tea', 150, 0, 'Less sugar atau tawar.', 'Less sugar or plain.'],
    ['Es jeruk', 'Iced orange juice', 120, 1, 'Sirupnya tambahan. Minta tanpa gula.', 'Syrup is added on top. Ask for no sugar.'],
    ['Jus alpukat + susu coklat', 'Avocado juice with chocolate milk', 420, 6, 'Ini mirip makan, bukan minum. Pilih satu atau lainnya.', 'More a meal than a drink. Skip the chocolate.'],
    ['Boba milk tea', 'Boba milk tea', 450, 4, 'Less sugar dan tanpa pearl bisa turun jauh.', 'Less sugar and no pearls cuts it a lot.'],
    ['Soda / minuman bersoda 330 ml', 'Soda 330 ml', 140, 0, 'Pilih yang zero sugar atau soda air putih.', 'Zero sugar or sparkling water.']
   ]}
  ]},

  { k: 'dinner', groups: [
   { k: 'jp', name: { id: 'Jepang / izakaya', en: 'Japanese / izakaya' }, items: [
    ['Sashimi platter', 'Sashimi platter', 300, 40, 'Pilihan paling aman untuk client dinner.', 'The safest pick for a client dinner.'],
    ['Shioyaki saba / ikan bakar garam', 'Salt-grilled mackerel', 350, 32, 'Ikan bakar sederhana dengan nasi setengah.', 'Simple grilled fish with half rice.'],
    ['Yakitori ayam 5 tusuk (shio)', 'Chicken yakitori 5 skewers (salt)', 330, 30, 'Pilih shio (garam), bukan tare (saus manis).', 'Choose shio (salt) over tare (sweet sauce).'],
    ['Teppanyaki steak + sayur', 'Teppanyaki steak + vegetables', 560, 42, 'Minta sayur ekstra dan nasi setengah.', 'Ask for extra veg and half rice.'],
    ['Yakiniku daging lean 200 g', 'Lean yakiniku beef 200 g', 480, 44, 'Pilih bagian lean, bukan karubi.', 'Pick lean cuts, not karubi.'],
    ['Chawanmushi + edamame + miso soup', 'Chawanmushi + edamame + miso soup', 260, 22, 'Pembuka yang ringan dan mengenyangkan.', 'A light starter that still fills.'],
    ['Unagi don', 'Unagi rice bowl', 660, 28, 'Sausnya manis. Nasi setengah.', 'Sweet sauce. Half rice.'],
    ['Tonkatsu set', 'Tonkatsu set', 920, 36, 'Digoreng tepung. Buang sebagian tepung, kol dobel.', 'Breaded and fried. Peel some off, double cabbage.'],
    ['Tempura mix', 'Mixed tempura', 620, 16, 'Sesekali. Satu atau dua per orang kalau dibagi.', 'Occasional. One or two each if sharing.']
   ]},
   { k: 'cn', name: { id: 'Chinese / seafood hotpot', en: 'Chinese / hotpot' }, items: [
    ['Ikan kukus + sayur', 'Steamed fish + greens', 300, 38, 'Kukus itu paling aman. Soy sauce di samping.', 'Steamed is the safest. Soy sauce on the side.'],
    ['Shabu-shabu daging slim + sayur', 'Shabu-shabu lean beef + veg', 460, 40, 'Kuah bening dan hindari dipping goreng.', 'Clear broth, skip the heavy dipping sauces.'],
    ['Cah brokoli ayam', 'Chicken & broccoli stir-fry', 320, 26, 'Minta sedikit minyak dan saus di samping.', 'Ask for less oil and sauce on the side.'],
    ['Sapo tahu seafood', 'Seafood tofu claypot', 340, 28, 'Kuah kental itu pati. Ambil lauknya dulu.', 'The thick sauce is starch. Eat the solids first.'],
    ['Dimsum kukus 6 pcs (siomay, hakau)', 'Steamed dim sum 6 pcs', 280, 16, 'Pilih yang kukus. Hindari goreng.', 'Choose steamed over fried.'],
    ['Ayam kungpao (tanpa nasi)', 'Kung pao chicken (no rice)', 480, 30, 'Kacangnya padat kalori. Cukup beberapa.', 'The peanuts are calorie-dense. A few is enough.'],
    ['Bebek peking 4 potong', 'Peking duck 4 slices', 430, 20, 'Kulit itu lemak. Ambil dagingnya.', 'The skin is fat. Go for the meat.'],
    ['Bubur ayam + cakwe', 'Chicken congee + fried dough', 380, 14, 'Bubur saja tanpa cakwe lebih ringan.', 'Congee alone is lighter.'],
    ['Nasi goreng Yangzhou', 'Yangzhou fried rice', 800, 20, 'Pilih nasi putih saja dan sepertiganya.', 'Plain rice, a third of it instead.'],
    ['Babi asam manis', 'Sweet & sour pork', 760, 24, 'Digoreng dan manis. Cukup sesekali.', 'Fried and sweet. An occasional one.']
   ]},
   { k: 'west', name: { id: 'Steak & western', en: 'Steak & Western' }, items: [
    ['Tenderloin 200 g + sayur + kentang tumbuk kecil', 'Tenderloin 200 g + veg + small mash', 640, 50, 'Medium rare cukup. Kentang tumbuk separuh.', 'Medium rare is fine. Half the mash.'],
    ['Grilled chicken breast + sayur', 'Grilled chicken breast + veg', 480, 45, 'Saus lada di samping.', 'Pepper sauce on the side.'],
    ['Salmon steak + asparagus', 'Salmon steak + asparagus', 560, 40, 'Lemon, bukan cream sauce.', 'Lemon, not cream sauce.'],
    ['Caesar salad + ayam', 'Chicken Caesar salad', 540, 30, 'Dressing di samping.', 'Dressing on the side.'],
    ['Sup jamur / tomat', 'Mushroom / tomato soup', 190, 5, 'Pembuka ringan. Hindari yang berbasis cream.', 'A light starter. Avoid the cream-based ones.'],
    ['Ribeye 300 g + kentang goreng', 'Ribeye 300 g + fries', 1180, 62, 'Protein bagus tapi lemaknya tinggi. Ganti kentang goreng dengan sayur.', 'Great protein but high fat. Swap the fries for veg.'],
    ['Burger + kentang goreng', 'Burger + fries', 1100, 36, 'Pilih satu dari dua: burger atau kentang.', 'Pick one of two: burger or fries.'],
    ['Fish & chips', 'Fish & chips', 1000, 32, 'Banyak minyak. Kentangnya satu sendok.', 'Very oily. Just a spoonful of chips.'],
    ['Pork ribs setengah rak + coleslaw', 'Half rack ribs + coleslaw', 1050, 48, 'Saus BBQ itu gula. Tanpa saus lebih baik.', 'BBQ sauce is sugar. Dry is better.']
   ]},
   { k: 'it', name: { id: 'Italian', en: 'Italian' }, items: [
    ['Ikan panggang (branzino) + sayur', 'Grilled branzino + veg', 400, 40, 'Hampir selalu pilihan terbaik di menu Italian.', 'Almost always the best pick on an Italian menu.'],
    ['Chicken piccata (tanpa pasta)', 'Chicken piccata (no pasta)', 450, 38, 'Saus lemon-caper itu ringan.', 'The lemon-caper sauce is light.'],
    ['Minestrone', 'Minestrone', 180, 8, 'Pembuka yang bagus.', 'A good starter.'],
    ['Caprese', 'Caprese', 300, 15, 'Keju mozzarella itu protein, tapi minyak zaitun banyak.', 'Mozzarella is protein, but there’s plenty of olive oil.'],
    ['Pizza margherita 2 slice', 'Margherita pizza 2 slices', 520, 20, 'Thin crust dan tanpa extra keju.', 'Thin crust, no extra cheese.'],
    ['Pasta pomodoro / aglio olio', 'Pomodoro / aglio olio pasta', 640, 15, 'Minta porsi setengah dan tambahkan protein: udang atau ayam.', 'Ask for a half portion and add prawns or chicken.'],
    ['Risotto jamur', 'Mushroom risotto', 680, 16, 'Risotto itu nasi dengan mentega dan keju. Cukup setengah.', 'Risotto is rice with butter and cheese. Half is plenty.'],
    ['Lasagna', 'Lasagna', 820, 32, 'Bagi dua dan tambah salad.', 'Share it and add a salad.'],
    ['Pasta carbonara', 'Pasta carbonara', 900, 28, 'Lemak dan keju. Sesekali saja.', 'Fat and cheese. An occasional treat.']
   ]},
   { k: 'kr', name: { id: 'Korean BBQ', en: 'Korean BBQ' }, items: [
    ['Bulgogi sapi lean + selada', 'Lean bulgogi beef + lettuce', 450, 36, 'Bungkus dengan selada, bukan nasi.', 'Wrap it in lettuce, not rice.'],
    ['Sundubu jjigae (sup tahu)', 'Sundubu jjigae (soft tofu stew)', 350, 25, 'Pilihan protein tinggi dan hangat. Pedasnya boleh.', 'High protein and warming. The spice is fine.'],
    ['Kimchi jjigae', 'Kimchi stew', 400, 26, 'Sodium tinggi. Kuah cukup sedikit.', 'High sodium. Go easy on the broth.'],
    ['Samgyeopsal 4 slice + selada', 'Pork belly 4 slices + lettuce', 600, 24, 'Lemaknya tinggi. Empat slice cukup.', 'High in fat. Four slices is plenty.'],
    ['Bibimbap batu panas', 'Hot stone bibimbap', 600, 22, 'Gochujang sedikit, nasi setengah.', 'Light gochujang, half rice.'],
    ['Japchae', 'Japchae', 400, 8, 'Mie kaca dan minyak wijen. Protein rendah.', 'Glass noodles and sesame oil. Low protein.'],
    ['Tteokbokki', 'Tteokbokki', 450, 9, 'Kue beras dan saus manis. Sesekali.', 'Rice cakes in sweet sauce. Occasionally.'],
    ['Galbi 250 g', 'Galbi 250 g', 760, 40, 'Marinasinya manis. Potong bagian lemak.', 'The marinade is sweet. Trim the fat.'],
    ['Korean fried chicken 6 pcs', 'Korean fried chicken 6 pcs', 900, 45, 'Digoreng dan bersaus. Dua atau tiga potong saja.', 'Fried and sauced. Two or three pieces.']
   ]},
   { k: 'sea', name: { id: 'Seafood', en: 'Seafood' }, items: [
    ['Ikan bakar kakap + sambal matah', 'Grilled snapper + sambal matah', 360, 46, 'Pilihan terbaik di restoran seafood.', 'The best pick at a seafood place.'],
    ['Udang bakar 8 ekor', 'Grilled prawns 8 pcs', 300, 40, 'Minta tanpa saus mentega.', 'No butter sauce.'],
    ['Kerang rebus + bumbu', 'Boiled clams', 250, 30, 'Kuah bumbu jangan diminum.', 'Don’t drink the sauce.'],
    ['Lobster panggang setengah', 'Grilled half lobster', 460, 40, 'Mentega di samping.', 'Butter on the side.'],
    ['Kepiting saus Padang (setengah)', 'Crab in Padang sauce (half)', 560, 35, 'Saus itu minyak dan gula. Makan dagingnya, sausnya sedikit.', 'The sauce is oil and sugar. Eat the meat, little sauce.'],
    ['Tumis kangkung / pakcoy bawang putih', 'Garlic water spinach / bok choy', 110, 4, 'Wajib ada satu sayur.', 'Always add one veg dish.'],
    ['Cumi goreng tepung', 'Battered fried squid', 620, 25, 'Digoreng. Bagi bersama.', 'Fried. Share it.'],
    ['Ikan goreng asam manis', 'Sweet and sour fried fish', 720, 40, 'Pilih steam atau bakar saja.', 'Steamed or grilled is lighter.']
   ]},
   { k: 'id', name: { id: 'Restoran Indonesia (Sunda / Jawa)', en: 'Indonesian restaurant' }, items: [
    ['Gurame bakar + lalap + sambal', 'Grilled gourami + raw veg + sambal', 380, 42, 'Pilihan klasik yang ringan.', 'A classic light choice.'],
    ['Pepes ikan + karedok', 'Steamed fish parcel + karedok', 330, 30, 'Karedok itu sayur mentah. Bumbu kacang sedikit.', 'Raw veg salad. Light on the peanut sauce.'],
    ['Ayam bakar bumbu rujak + nasi ½', 'Rujak-glazed grilled chicken + half rice', 540, 35, 'Bumbu manis. Kulit boleh dibuang.', 'The glaze is sweet. Peel the skin.'],
    ['Sate ayam 10 + lontong', 'Chicken satay 10 + rice cake', 520, 36, 'Saus kacang sedikit.', 'Light on the sauce.'],
    ['Sop buntut', 'Oxtail soup', 450, 30, 'Pilih sop bukan goreng.', 'Choose the soup, not the fried.'],
    ['Rendang 2 potong (tanpa nasi)', 'Rendang 2 pieces (no rice)', 480, 30, 'Satu atau dua potong sudah cukup.', 'One or two pieces is enough.'],
    ['Nasi liwet komplit', 'Nasi liwet set', 800, 26, 'Nasinya banyak. Ambil lauk dan lalap.', 'The rice is the heavy part. Take the sides and veg.'],
    ['Gudeg komplit', 'Gudeg set', 700, 24, 'Manis dan santan. Ambil telur dan ayam, kurangi sambal krecek.', 'Sweet and coconut. Take egg and chicken, less krecek.']
   ]},
   { k: 'cafe', name: { id: 'Café & brunch', en: 'Café & brunch' }, items: [
    ['Omelette 3 telur + sayur', 'Three-egg omelette + veg', 380, 24, 'Roti panggang satu lembar.', 'One slice of toast.'],
    ['Avocado toast + telur', 'Avocado toast + egg', 450, 17, 'Tambah satu telur lagi buat protein.', 'Add a second egg for protein.'],
    ['Chicken club sandwich', 'Chicken club sandwich', 650, 32, 'Kentang goreng jangan dihabiskan.', 'Don’t finish the fries.'],
    ['Salad nicoise', 'Niçoise salad', 450, 30, 'Dressing di samping.', 'Dressing on the side.'],
    ['Granola + yogurt', 'Granola + yogurt', 400, 14, 'Granola itu gula dan minyak. Takaran secukupnya.', 'Granola is sugar and oil. Keep the portion small.'],
    ['Eggs Benedict', 'Eggs Benedict', 720, 28, 'Hollandaise itu mentega. Minta saus sedikit.', 'Hollandaise is butter. Ask for less.'],
    ['Croissant + kopi', 'Croissant + coffee', 350, 7, 'Enak, tapi cepat lapar lagi.', 'Tasty, but you’ll be hungry soon.'],
    ['Pancake + sirup + bacon', 'Pancakes + syrup + bacon', 900, 18, 'Itu dessert. Pilih satu stack, bukan tiga.', 'That’s dessert. One stack, not three.']
   ]},
   { k: 'minum', name: { id: 'Minum & penutup', en: 'Drinks & dessert' }, drink: true, items: [
    ['Air putih / sparkling water', 'Still / sparkling water', 0, 0, 'Pilihan paling aman kapan saja.', 'The safest at any time.'],
    ['Espresso / americano', 'Espresso / americano', 5, 0, 'Penutup yang pas.', 'A fitting finish.'],
    ['Buah potong', 'Fresh fruit plate', 120, 1, 'Penutup paling ringan.', 'The lightest dessert.'],
    ['Red wine 1 gelas', 'Red wine, 1 glass', 125, 0, 'Satu gelas dan selingi air.', 'One glass, with water in between.'],
    ['Bir 330 ml', 'Beer 330 ml', 150, 1, 'Selingi air putih.', 'Alternate with water.'],
    ['Cocktail', 'Cocktail', 250, 0, 'Sirup dan jus itu gula. Minta less sweet.', 'Syrups and juice are sugar. Ask for less sweet.'],
    ['Es krim 2 scoop', 'Ice cream 2 scoops', 270, 4, 'Satu scoop cukup, atau bagi berdua.', 'One scoop, or share.'],
    ['Tiramisu', 'Tiramisu', 450, 6, 'Bagi berdua.', 'Share between two.'],
    ['Cheesecake 1 slice', 'Cheesecake 1 slice', 480, 8, 'Bagi berdua.', 'Share between two.']
   ]}
  ]}
 ]
};
