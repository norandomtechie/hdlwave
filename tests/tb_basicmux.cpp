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

    top->hz100 = 0;
    top->reset = 0;
    top->pb = 0;
    top->txready = 0;
    top->rxready = 0;

    // outputs
    // top->ss7 // top->ss6 // top->ss5 // top->ss4 // top->ss3 // top->ss2 // top->ss1 // top->ss0
    // top->left // top->right
    // top->red // top->green // top->blue
    // top->txdata // top->txclk
    // top->rxdata // top->rxclk

    int pb0, pb1, pb2;

    for (int i = 0; i < 8; i++) {
        main_time++;  // Time passes...
        top->hz100 = top->hz100 == 1 ? 0 : 1;
        top->pb = i;
        pb0 = top->pb & 0x1; pb1 = top->pb & 0x2 ? 1 : 0; pb2 = top->pb & 0x4 ? 1 : 0;
        
        top->eval();

        if ((top->right & 0x1) == (pb0 ? pb1 : pb2))
            printf ("At value %d, right value was correct = %d\n", i, top->right & 0x1);
        else
            printf ("pb0 = %d, pb1 = %d, pb2 = %d, right[0] = %d\n", pb0, pb1, pb2, (top->right & 0x1));
    }
    main_time++;  // Time passes...

    // Final model cleanup
    top->final();

    // Destroy model
    delete top;
    top = NULL;

    // Fin
    exit(0);
}