//原データ配列（乱数）を作成する関数
var getRawData = function (num) {
  var rndrange = $("#rndrange").val() / 100;
  var shokichi = 100; //データの初期値
  var dataarr = [shokichi];
  for (let i = 1; i < num; i++) {
    var r = Math.random() * shokichi * rndrange; //0から100
    dataarr.push(dataarr[i - 1] + (r - (shokichi * rndrange) / 2)); //平均が50になるように設定
  }
  return dataarr;
};

//原データの指数平滑移動平均値を返す関数
function EMACalc(mArray, mRange) {
  var k = 2 / (mRange + 1);
  // first item is just the same as the first item in the input
  emaArray = [mArray[0]];
  // for the rest of the items, they are computed with the previous one
  for (var i = 1; i < mArray.length; i++) {
    emaArray.push(mArray[i] * k + emaArray[i - 1] * (1 - k));
  }
  return emaArray;
}

//分析対象のデータ群を設定する関数
var getDataSet = function (mArray) {
  var p1 = $("#p1").val();
  var p2 = $("#p2").val();
  var data1 = mArray;
  var data2 = EMACalc(data1, p1);
  var data3 = EMACalc(data1, p2);

  return [data1, data2, data3];
};

//静止グラフ作成
async function getGraph_S(mArray) {
  var dataArrs = getDataSet(mArray);
  // console.log(dataArrs);
  var d1 = dataArrs[0];
  var d2 = dataArrs[1];
  var d3 = dataArrs[2];

  var p1 = $("#p1").val();
  var p2 = $("#p2").val();
  var n1 = "random";
  var n2 = `EMA(${p1})`;
  var n3 = `EMA(${p2})`;

  await Plotly.newPlot("chart", [
    { y: d1, name: n1, line: { width: 1, color: "black" } },
    { y: d2, name: n2, line: { width: 1, color: "blue" } },
    { y: d3, name: n3, line: { width: 1, color: "red" } },
  ]);
}

//ゴールデンクロス・デッドクロスのシグナル配列を返す関数
var GCDC = function (a, b) {
  var a_b = [];
  for (let i = 0; i < a.length; i++) {
    a_b.push(a[i] - b[i]);
  }
  var gcdc = [0];
  for (let j = 1; j < a.length; j++) {
    if (a_b[j - 1] < 0 && a_b[j] >= 0) {
      gcdc.push(1);
    } else if (a_b[j - 1] > 0 && a_b[j] <= 0) {
      gcdc.push(-1);
    } else {
      gcdc.push(0);
    }
  }
  return gcdc;
};

//損益計算
var calcPL_tan = function (mArray) {
  //投資ロジックの選定（今回はGC/DC）
  var data1 = getDataSet(mArray)[1];
  var data2 = getDataSet(mArray)[2];
  var logic = GCDC(data1, data2);

  var PL_tan = 0; //損益率
  var trade = 0; //トレード回数
  var shokai = 1; //初回判定フラグ
  var Buy_Price; //買値
  var Sell_Price; //売値

  for (let i = 0; i < mArray.length; i++) {
    if (logic[i] === 1) {
      Buy_Price = mArray[i]; //新規買い建て
      if (shokai !== 1) {
        PL_tan += (Sell_Price - mArray[i]) / Math.abs(Sell_Price); //売り玉の損益確定
        trade += 1; //決済時にトレードカウント
      } else {
        shokai = 0;
      }
    } else if (logic[i] === -1) {
      Sell_Price = mArray[i]; //新規売り建て
      if (shokai !== 1) {
        PL_tan += (mArray[i] - Buy_Price) / Math.abs(Buy_Price); //買い玉の損益確定
        trade += 1;
      } else {
        shokai = 0;
      }
    }
  }

  return [PL_tan * 100, trade, (PL_tan / trade) * 100]; //（通算損益率、トレード回数、平均損益率（算術平均））
};

//検証結果出力
function plot_PL(mArray) {
  var PL = calcPL_tan(mArray)[0].toFixed(2);
  var TR = calcPL_tan(mArray)[1];
  var AVR = calcPL_tan(mArray)[2].toFixed(2);

  $("#pl").html(`<div>＜投資結果＞</div><li>トレード回数：${TR}回</li>
  <li>通算損益率：${PL}%</li>
  <li>1トレードの平均損益率：${AVR}%</li>`);
}

$("#button1").on("click", function () {
  var datanum = $("#datanum").val(); //データの個数
  var rndary = getRawData(datanum);
  getGraph_S(rndary);
  plot_PL(rndary);
});

//モンテカルロシミュレーション
var Simulation = function (smlnum) {
  var smlarr = [];
  var sum = 0;
  var datanum = $("#datanum").val();
  var count = 0;
  for (let i = 0; i < smlnum; i++) {
    var rndary = getRawData(datanum);
    var AVR = calcPL_tan(rndary)[2]; //平均損益率
    if (isNaN(AVR)) {
      count += 1;
    } else {
      smlarr.push(AVR);
      sum += AVR;
    }
  }
  var mu = sum / (smlnum - count);
  var a = 0;
  smlarr.forEach((element) => {
    a += (element - mu) ** 2;
  });
  console.log(count);
  var sd = (a / (smlnum - count)) ** (1 / 2);

  return [smlarr, mu, sd, smlnum - count];
};

$("#button2").on("click", function () {
  var smlnum = $("#smlnum").val();
  var result = new Promise(function (resolve) {
    resolve(Simulation(smlnum));
  });

  result.then(function (value) {
    console.log(Math.max(...value[0]));
    console.log(Math.min(...value[0]));
    $(
      "#simulation"
    ).html(`＜モンテカルロシミュレーション結果＞<li>試行回数：${smlnum}回（うちトレードあり${value[3]}回）</li>
    <li>平均損益率の分布：平均 ${value[1].toFixed(2)}%, 
    標準偏差${value[2].toFixed(2)}%</li>`);

    Plotly.newPlot("myDiv", [
      {
        x: value[0],
        type: "histogram",
      },
    ]);
  });
});
