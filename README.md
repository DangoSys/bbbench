# 3BBench

The bench of hardware–software co-design: Buckyball, Buddy Compiler and Bloom,
measured together on the same designs and the same workloads.

## 评估prefab
1. ball 

**开发者**
bbdev dc --area '--ball relu'
bbdev yosys --run '--ball relu'
bbdev uvm --run '--ball relu'
bbdev dc --power '--ball relu'
bbdev uvm --run '--ball relu --performance'

**bench**
bbdev bench-prefab --area '--ball relu'
bbdev bench-prefab --area '--ball all'

bbdev bench-prefab --uvm '--ball relu'
bbdev bench-prefab --uvm '--ball all'

bbdev bench-prefab --power '--ball relu'
bbdev bench-prefab --power '--ball all'

bbdev bench-prefab --performance '--ball relu'
bbdev bench-prefab --performance '--ball all'

2. thread 
**开发者**
bbdev workload --build "--thread piplus/threads/dense"

bbdev bebop-bemu --batch "--thread piplus/threads/dense --test bare-tests"

bbdev bebop-verilator --verilog "--thread piplus/threads/dense"

bbdev bebop-verilator --build "--thread piplus/threads/dense"

bbdev bebop-verilator --sim "--thread piplus/threads/dense --test dense-thread-mxint8mm_small-baremetal"

bbdev bebop-verilator --batch "--thread piplus/threads/dense --test bare-tests"

**bench**
bbdev bench-prefab --area '--thread matmul'
bbdev bench-prefab --area '--thread all'

bbdev bench-prefab --power '--thread matmul'
bbdev bench-prefab --power '--thread all'

bbdev bench-prefab --test '--thread matmul'
bbdev bench-prefab --test '--thread all'


3. hart
**开发者**
bbdev workload --build "--hart rocket"

bbdev bebop-bemu --batch "--hart rocket --test bare-tests"

bbdev bebop-verilator --verilog "--hart rocket"

bbdev bebop-verilator --build "--hart rocket"

bbdev bebop-verilator --sim "--hart rocket --test dense-thread-mxint8mm_small-baremetal"

bbdev bebop-verilator --batch "--hart rocket --test bare-tests"

**bench**
bbdev bench-prefab --area '--hart rocket'
bbdev bench-prefab --area '--hart all'

bbdev bench-prefab --power '--hart rocket'
bbdev bench-prefab --power '--hart all'

bbdev bench-prefab --test '--hart rocket'
bbdev bench-prefab --test '--hart all'

## 评估design



1. 第一步 workload build

**开发者**
bbdev stack --build "--config pebble/devices/pebble/configs/PebbleTapeoutConfig.toml --device pebble"

bbdev workload --build "--config pebble/devices/pebble/configs/PebbleTapeoutConfig.toml --device pebble"

**bench**
bbdev bench-device --workload "--device pebble"
bbdev bench-device --workload "--device all"


2. 第二步 bemu workload

**开发者**
(1) bare 
bbdev bebop-bemu --batch "--config pebble/devices/pebble/configs/PebbleTapeoutConfig.toml --device pebble --test bare-tests --jobs 16"

(1.2) os
bbdev image --build "--config pebble/devices/pebble/configs/PebbleTapeoutConfig.toml --device pebble"

bbdev bebop-bemu --batch "--config pebble/devices/pebble/configs/PebbleTapeoutConfig.toml --device pebble --test linux-tests --jobs 16"

**bench**
bbdev bench-device --bemu-workload "--device pebble"
bbdev bench-device --bemu-workload "--device all"

3. 第三步 verilator-workload
**开发者**
bbdev bebop-verilator --verilog "--config pebble/devices/pebble/configs/PebbleVerilatorConfig.toml --device pebble --diff"

bbdev bebop-verilator --build "--config pebble/devices/pebble/configs/PebbleVerilatorConfig.toml --device pebble --diff --jobs 16"

bbdev bebop-verilator --batch "--config pebble/devices/pebble/configs/PebbleVerilatorConfig.toml --device pebble --test bare-tests --diff --jobs 16"

**bench**
bbdev bench-device --verilator-workload "--device pebble"
bbdev bench-device --verilator-workload "--device all"

4.1. 第4-1步 model build

**开发者**
bbdev model --build "--config pebble/devices/pebble/configs/PebbleTapeoutConfig.toml --device pebble --model all"

(1) bare 
bbdev bebop-bemu --sim "--config pebble/devices/pebble/configs/PebbleTapeoutConfig.toml --device pebble --model lenet --os baremetal"

(2) os
bbdev image --build "--config pebble/devices/pebble/configs/PebbleTapeoutConfig.toml --device pebble --model lenet"

bbdev bebop-bemu --sim "--config pebble/devices/pebble/configs/PebbleTapeoutConfig.toml --device pebble --model lenet --os linux"

**bench**
bbdev bench-device --model-build "--device pebble"
bbdev bench-device --model-build "--device all"

bbdev bench-device --bemu-model "--device pebble"
bbdev bench-device --bemu-model "--device all"

4.2. 第4-2步 bench build

**开发者**
bbdev bench --build "--config pebble/devices/pebble/configs/PebbleTapeoutConfig.toml --device pebble --bench all"

(1) bare 
bbdev bebop-bemu --sim "--config pebble/devices/pebble/configs/PebbleTapeoutConfig.toml --device pebble --bench embench --os baremetal"

(2) os
bbdev image --build "--config pebble/devices/pebble/configs/PebbleTapeoutConfig.toml --device pebble --bench embench"

bbdev bebop-bemu --sim "--config pebble/devices/pebble/configs/PebbleTapeoutConfig.toml --device pebble --bench embench --os linux"

**bench**
bbdev bench-device --bench-build "--device pebble"
bbdev bench-device --bench-build "--device all"

bbdev bench-device --bemu-bench "--device pebble"
bbdev bench-device --bemu-bench "--device all"

4.3. 第4-3步 bemu-accuracy

**bench**
bbdev bench-device --bemu-accuracy "--device pebble"
bbdev bench-device --bemu-accuracy "--device all"

5.1. 第5-1步 verilator-gvn

**开发者**
bbdev gvn-bemu --debug "--config pebble/devices/pebble/configs/PebbleVerilatorConfig.toml --device pebble --model lenet"

bbdev bebop-verilator --build "--config pebble/devices/pebble/configs/PebbleVerilatorConfig.toml --device pebble --jobs 16"

bbdev gvn-verilator --perform "--config pebble/devices/pebble/configs/PebbleVerilatorConfig.toml --device pebble --model lenet"

bbdev gvn-verilator --debug "--config pebble/devices/pebble/configs/PebbleVerilatorConfig.toml --device pebble --model lenet"

**bench**
bbdev bench-device --verilator-gvn "--device pebble"
bbdev bench-device --verilator-gvn "--device all"

5.2. 第5-2步 uvm

**开发者**
bbdev uvm --run "--device pebble --ip axi4"

**bench**
bbdev bench-device --uvm "--device pebble"
bbdev bench-device --uvm "--device all"

5.3. 第5-3步 dc-area

**开发者**
bbdev dc --area "--device pebble"

**bench**
bbdev bench-device --dc-area "--device pebble"
bbdev bench-device --dc-area "--device all"

5.4. 第5-4步 power

**开发者**
bbdev dc --power "--device pebble"

**bench**
bbdev bench-device --power "--device pebble"
bbdev bench-device --power "--device all"

5.5. 第5-5步 fpga-bitstream

**开发者**
bbdev bebop-p2e --verilog "--device pebble --diff"

bbdev bebop-p2e --buildbitstream "--device pebble --diff"

**bench**
bbdev bench-device --buildbitstream "--device pebble --diff"
bbdev bench-device --buildbitstream "--device all --diff"

5.6. 第5-6步 fpga-workload

**开发者**
bbdev bebop-p2e --batch "--device pebble --bitstream <path> --test bare-tests --diff"

bbdev bebop-p2e --batch "--device pebble --bitstream <path> --test linux-tests --diff"

**bench**
bbdev bench-device --fpga-workload "--device pebble"

5.7. 第5-7步 fpga-gvn

**开发者**
bbdev gvn-p2e --perform "--device pebble --model lenet --bitstream <path>"

bbdev gvn-p2e --debug "--device pebble --model lenet --bitstream <path>"

**bench**
bbdev bench-device --fpga-gvn "--device pebble"

5.8. 第5-8步 fpga-model

**开发者**
bbdev bebop-p2e --runworkload "--device pebble --model lenet --os baremetal --bitstream <path>"

bbdev bebop-p2e --runworkload "--device pebble --model lenet --os linux --bitstream <path>"

**bench**
bbdev bench-device --fpga-model "--device pebble"


## 评估tools


1. 评估 bemu 的仿真速度

(1) 最快速度
bbdev bench-tool --bemu '--device pebble'
bbdev bench-tool --bemu '--device all'

(2) 只开所有trace
bbdev bench-tool --bemu '--device pebble --all-trace'
bbdev bench-tool --bemu '--device all --all-trace'


2. 评估 verilator 的仿真速度

(1) 最快速度
bbdev bench-tool --verilator '--device pebble'
bbdev bench-tool --verilator '--device all'

(2) 只开所有trace
bbdev bench-tool --verilator '--device pebble --all-trace'
bbdev bench-tool --verilator '--device all --all-trace'

(3) 只开difftest
bbdev bench-tool --verilator '--device pebble --diff'
bbdev bench-tool --verilator '--device all --diff'



3. 评估 FPGA 的仿真速度

(1) 最快速度
bbdev bench-tool --p2e '--device pebble'
bbdev bench-tool --p2e '--device all'

(2) 只开所有trace
bbdev bench-tool --p2e '--device pebble --all-trace'
bbdev bench-tool --p2e '--device all --all-trace'

(3) 只开difftest
bbdev bench-tool --p2e '--device pebble --diff'
bbdev bench-tool --p2e '--device all --diff'

4. 性能评估的精度与速度

网页 Tools 页的 Latency simulation 两张图，数据取自 design 时间线上已有的结果，不另跑。

(1) 评估精度
bemu得到model 周期数：bbdev bench-device --bemu-model 的 bare metal 周期数
verialtor+gvn得到 周期数：bbdev bench-device --verilator-gvn 每个模型的估算周期数
FPGA得到 周期数：bbdev bench-device --fpga-model 的 bare metal 周期数

(2) 评估速度
bemu得到model 耗时：bbdev bench-device --bemu-model 每个模型 bare metal 的耗时
verialtor+gvn得到 耗时：bbdev bench-device --verilator-gvn 每个模型的耗时
FPGA得到 耗时：bbdev bench-device --fpga-model 每个模型 bare metal 的耗时
