// DESCRIPTION: Verilator: Verilog example module
//
// This file ONLY is placed under the Creative Commons Public Domain, for
// any use, without warranty, 2017 by Wilson Snyder.
// SPDX-License-Identifier: CC0-1.0
//======================================================================

// Include common routines
#include <verilated.h>

// Include model header, generated from Verilating "tb_top.v"
#include "Vtb_top.h"

// Current simulation time (64-bit unsigned)
vluint64_t main_time = 0;
// Called by $time in Verilog
double sc_time_stamp() {
    return main_time;  // Note does conversion to real, to match SystemC
}

int main(int argc, char** argv, char** env) {
    // This is a more complicated example, please also see the simpler examples/make_hello_c.

    // Prevent unused variable warnings
    if (0 && argc && argv && env) {}

    // Set debug level, 0 is off, 9 is highest presently used
    // May be overridden by commandArgs
    Verilated::debug(0);

    // Randomization reset policy
    // May be overridden by commandArgs
    Verilated::randReset(2);

    // Verilator must compute traced signals
    Verilated::traceEverOn(true);

    // Pass arguments so Verilated code can see them, e.g. $value$plusargs
    // This needs to be called before you create any model
    Verilated::commandArgs(argc, argv);

    // Create logs/ directory in case we have traces to put under it
    Verilated::mkdir("trace");

    // Construct the Verilated model, from Vtop.h generated from Verilating "top.v"
    Vtb_top* top = new Vtb_top;  // Or use a const unique_ptr, or the VL_UNIQUE_PTR wrapper

    
    main_time++;
    top->hz100 = 0b1;
    top->pb = 0b000000000000000000001;
    top->reset = 0b0;
    top->txready = 0b0;
    top->rxdata = 0b00000000;
    top->rxready = 0b0;

    top->eval();


    main_time++;
    top->hz100 = 0b0;
    top->pb = 0b000000000000000000010;
    top->rxdata = 0b00010000;
    top->rxready = 0b0;

    top->eval();


    main_time++;
    top->hz100 = 0b1;
    top->pb = 0b000000000000000000100;
    top->rxdata = 0b00010000;
    top->rxready = 0b0;

    top->eval();


    main_time++;
    top->hz100 = 0b0;
    top->pb = 0b000000000000000001000;
    top->rxdata = 0b00010000;
    top->rxready = 0b0;

    top->eval();


    main_time++;
    top->hz100 = 0b1;
    top->pb = 0b000000000000000010010;
    top->reset = 0b1;
    top->txready = 0b0;
    top->rxdata = 0b00010000;
    top->rxready = 0b0;

    top->eval();


    main_time++;
    top->hz100 = 0b0;
    top->pb = 0b000000000000000100001;
    top->reset = 0b1;
    top->rxdata = 0b00010000;
    top->rxready = 0b0;

    top->eval();


    main_time++;
    top->hz100 = 0b1;
    top->pb = 0b000000000000001000111;
    top->reset = 0b1;
    top->rxdata = 0b00010000;
    top->rxready = 0b0;

    top->eval();


    main_time++;
    top->hz100 = 0b0;
    top->pb = 0b000000000000010010001;
    top->reset = 0b1;
    top->rxdata = 0b00010000;
    top->rxready = 0b0;

    top->eval();


    main_time++;
    top->hz100 = 0b1;
    top->pb = 0b000000000000100100000;
    top->rxdata = 0b00010000;

    top->eval();


    main_time++;
    top->hz100 = 0b0;
    top->rxdata = 0b00000000;

    top->eval();


    // Final model cleanup
    top->final();

    // Destroy model
    delete top;
    top = NULL;

    // Fin
    exit(0);
}